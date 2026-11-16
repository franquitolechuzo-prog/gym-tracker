import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../../components/ui';
import { PlusIcon } from '../../components/icons';
import { useConfirm } from '../../components/confirm';
import { db } from '../../db/db';
import type { Session, SessionExercise } from '../../db/types';
import {
  addSet,
  findRoutineTarget,
  getExerciseHistory,
  listSets,
  moveSessionExercise,
  removeSessionExercise,
  updateSessionExerciseNotes,
  updateSet,
} from '../../db/sessions';
import { useSettings } from '../../db/settings';
import { alignWithPrevious, compareToPrevious, computeRecords, detectPRs, formatSet, mergeRecords, type PRKind } from '../../lib/progress';
import { suggestProgression } from '../../lib/stats';
import { startRest } from './restTimer';
import { SetRow } from './SetRow';

const PR_LABELS: Record<PRKind, string> = {
  weight: 'peso máximo',
  reps: 'más reps con ese peso',
  '1rm': 'mejor 1RM estimado',
};

export function ExerciseCard({
  item,
  session,
  isFirst,
  isLast,
  onReplace,
  onRecord,
}: {
  item: SessionExercise;
  session: Session;
  isFirst: boolean;
  isLast: boolean;
  onReplace: () => void;
  onRecord: (message: string) => void;
}) {
  const settings = useSettings();
  const confirm = useConfirm();
  const [menu, setMenu] = useState(false);
  const [showNotes, setShowNotes] = useState(!!item.notes);
  const [notes, setNotes] = useState(item.notes ?? '');

  const exercise = useLiveQuery(() => db.exercises.get(item.exerciseId), [item.exerciseId]);
  const sets = useLiveQuery(() => listSets(item.id), [item.id]);
  const target = useLiveQuery(
    async () => (session.routineId ? ((await findRoutineTarget(session.routineId, item.exerciseId)) ?? null) : null),
    [session.routineId, item.exerciseId],
  );
  const history = useLiveQuery(
    () => getExerciseHistory(item.exerciseId, { excludeSessionId: session.id, before: session.startedAt }),
    [item.exerciseId, session.id, session.startedAt],
  );
  const records = useMemo(() => computeRecords(history?.flatMap((h) => h.sets) ?? []), [history]);

  if (!exercise || !sets || history === undefined || target === undefined) {
    return <section className="min-h-40 rounded-2xl bg-neutral-900" aria-busy="true" />;
  }

  const previous = history[0]?.sets ?? [];
  const aligned = alignWithPrevious(sets, previous);
  /** Records to beat for set i: history plus sets already done earlier in this session. */
  const recordsBefore = (i: number) => mergeRecords(records, sets.slice(0, i).filter((s) => s.done));

  const toggleDone = async (i: number) => {
    const fresh = await db.sets.get(sets[i].id); // read committed values (stepper may have just saved)
    if (!fresh) return;
    const done = !fresh.done;
    await updateSet(fresh.id, { done });
    if (!done) return;
    const prs = detectPRs(fresh, recordsBefore(i));
    if (prs.length > 0) {
      onRecord(
        `🏆 ¡Nuevo récord en ${exercise.name}! ${formatSet(fresh.weight, fresh.reps, exercise.unit, exercise.isBodyweight)} (${prs
          .map((p) => PR_LABELS[p])
          .join(', ')})`,
      );
    }
    void startRest(target?.restSeconds ?? settings.defaultRestSeconds, exercise.name);
  };

  const onRemove = async () => {
    const doneCount = sets.filter((s) => s.done).length;
    const ok =
      doneCount === 0 ||
      (await confirm({
        title: `¿Quitar ${exercise.name}?`,
        message: `Se borran las ${doneCount} series que ya marcaste en este ejercicio.`,
        confirmLabel: 'Quitar',
        danger: true,
      }));
    if (ok) await removeSessionExercise(item.id);
  };

  const targetText =
    target &&
    `Objetivo: ${target.targetSets} × ${
      target.targetRepsMin !== undefined && target.targetRepsMax !== undefined && target.targetRepsMin !== target.targetRepsMax
        ? `${target.targetRepsMin}–${target.targetRepsMax}`
        : (target.targetRepsMin ?? target.targetRepsMax ?? '?')
    }`;
  const doneCount = sets.filter((s) => s.done).length;

  // Progressive overload: offer to raise the pending working sets by one increment.
  const suggestion = suggestProgression(previous, target ?? undefined, settings.weightIncrement);
  const belowSuggestion = suggestion ? sets.filter((s) => !s.done && !s.isWarmup && s.weight < suggestion.weight) : [];
  const applySuggestion = () =>
    db.transaction('rw', db.sets, () => Promise.all(belowSuggestion.map((s) => updateSet(s.id, { weight: suggestion!.weight }))));

  return (
    <section aria-labelledby={`se-${item.id}`} className="overflow-hidden rounded-2xl bg-neutral-900">
      <header className="flex items-start gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <h2 id={`se-${item.id}`} className="text-lg leading-tight font-bold">
            {exercise.name}
          </h2>
          <p className="text-sm text-neutral-500">
            {[targetText, `${doneCount}/${sets.length} hechas`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Opciones de ${exercise.name}`}
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className="-mt-1 h-12 w-12 shrink-0 rounded-full text-2xl leading-none text-neutral-400 active:bg-neutral-800"
        >
          ⋯
        </button>
      </header>

      {menu && (
        <div className="grid grid-cols-2 gap-2 px-3 pt-2">
          <Button onClick={() => (setShowNotes(true), setMenu(false))}>Notas</Button>
          <Button onClick={() => (onReplace(), setMenu(false))}>Reemplazar</Button>
          <Button disabled={isFirst} onClick={() => moveSessionExercise(item.id, -1)}>
            ↑ Subir
          </Button>
          <Button disabled={isLast} onClick={() => moveSessionExercise(item.id, 1)}>
            ↓ Bajar
          </Button>
          <Button variant="danger" className="col-span-2" onClick={onRemove}>
            Quitar ejercicio
          </Button>
        </div>
      )}

      {suggestion && belowSuggestion.length > 0 && (
        <div className="mx-3 mt-2 flex items-center gap-3 rounded-xl bg-sky-950/70 p-3 text-sky-100">
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">
              💡 Probá con {formatSet(suggestion.weight, 0, exercise.unit, exercise.isBodyweight).replace(/ × 0$/, '')}
            </span>
            <span className="block text-sky-200/80">{suggestion.reason}.</span>
          </span>
          <Button variant="secondary" className="shrink-0" onClick={applySuggestion}>
            Aplicar
          </Button>
        </div>
      )}

      {showNotes && (
        <div className="px-3 pt-2">
          <label htmlFor={`notes-${item.id}`} className="sr-only">
            Notas de {exercise.name}
          </label>
          <textarea
            id={`notes-${item.id}`}
            rows={2}
            placeholder="Notas (ej.: 80 en prensa grande)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => updateSessionExerciseNotes(item.id, notes)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-base outline-none focus:border-accent"
          />
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 px-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        <span className="text-center">
          {exercise.isBodyweight ? 'Lastre' : 'Peso'} ({exercise.unit})
        </span>
        <span className="text-center">Reps</span>
      </div>
      <ul className="divide-y divide-neutral-800">
        {sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            exercise={exercise}
            previous={aligned[i]}
            comparison={set.isWarmup ? undefined : compareToPrevious(set, aligned[i])}
            weightStep={settings.weightIncrement}
            prs={set.done ? detectPRs(set, recordsBefore(i)) : []}
            onToggleDone={() => toggleDone(i)}
          />
        ))}
      </ul>
      <div className="p-3">
        <Button className="w-full" onClick={() => addSet(item.id)}>
          <PlusIcon /> Agregar serie
        </Button>
      </div>
    </section>
  );
}
