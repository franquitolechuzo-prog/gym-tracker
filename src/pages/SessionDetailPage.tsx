import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/Layout';
import { Button, Field, inputClass } from '../components/ui';
import { PlusIcon } from '../components/icons';
import { useConfirm } from '../components/confirm';
import { db } from '../db/db';
import type { Session, SessionExercise } from '../db/types';
import { addSet, deleteSession, listSessionExercises, listSets, removeSessionExercise, updateSession, updateSessionExerciseNotes } from '../db/sessions';
import { useSettings } from '../db/settings';
import { formatLongDate, formatWeight } from '../lib/format';
import { epley1RM, totalVolume } from '../lib/strength';
import { SetRow } from '../features/session/SetRow';

/** View and edit a finished session. Every change is saved immediately. */
export function SessionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const session = useLiveQuery(async () => (await db.sessions.get(id)) ?? null, [id]);
  const data = useLiveQuery(async () => {
    const s = await db.sessions.get(id);
    const routine = s?.routineId ? await db.routines.get(s.routineId) : undefined;
    return { routine, items: await listSessionExercises(id) };
  }, [id]);

  if (session === null) {
    return (
      <>
        <PageHeader title="Sesión" back />
        <p className="p-4 text-neutral-500">Esta sesión no existe.</p>
      </>
    );
  }
  if (!session || !data) return <PageHeader title="Sesión" back />;

  const title = session.routineId ? (data.routine?.name ?? 'Rutina eliminada') : 'Sesión libre';

  const onDelete = async () => {
    const ok = await confirm({
      title: '¿Eliminar esta sesión?',
      message: `Se borran todas las series del ${formatLongDate(session.date)}. No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    await deleteSession(session.id);
    navigate(-1);
  };

  return (
    <>
      <PageHeader title={title} back />
      <SessionMeta session={session} />
      <div className="flex flex-col gap-3 p-3">
        {data.items.map((item) => (
          <PastExerciseCard key={item.id} item={item} />
        ))}
        {data.items.length === 0 && <p className="py-4 text-center text-neutral-500">Esta sesión no tiene ejercicios.</p>}
        <Button variant="danger" className="mt-4" onClick={onDelete}>
          Eliminar sesión
        </Button>
      </div>
    </>
  );
}

function SessionMeta({ session }: { session: Session }) {
  const [notes, setNotes] = useState(session.notes ?? '');
  useEffect(() => setNotes(session.notes ?? ''), [session.notes]);
  const duration = session.finishedAt ? Math.round((session.finishedAt - session.startedAt) / 60_000) : undefined;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="session-date">
          <input
            id="session-date"
            type="date"
            className={inputClass}
            value={session.date}
            onChange={(e) => e.target.value && updateSession(session.id, { date: e.target.value })}
          />
        </Field>
        {duration !== undefined && duration > 0 && duration < 360 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-400">Duración</span>
            <span className="flex h-12 items-center text-lg font-semibold">{duration} min</span>
          </div>
        )}
      </div>
      <Field label="Notas de la sesión" htmlFor="session-notes">
        <textarea
          id="session-notes"
          rows={2}
          className={`${inputClass} h-auto py-3`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (session.notes ?? '') && updateSession(session.id, { notes })}
        />
      </Field>
    </div>
  );
}

function PastExerciseCard({ item }: { item: SessionExercise }) {
  const settings = useSettings();
  const confirm = useConfirm();
  const exercise = useLiveQuery(() => db.exercises.get(item.exerciseId), [item.exerciseId]);
  const sets = useLiveQuery(() => listSets(item.id), [item.id]);
  const [notes, setNotes] = useState(item.notes ?? '');

  if (!exercise || !sets) return <section className="min-h-32 rounded-2xl bg-neutral-900" aria-busy="true" />;

  const onRemove = async () => {
    const ok = await confirm({
      title: `¿Quitar ${exercise.name} de esta sesión?`,
      message: `Se borran sus ${sets.length} series.`,
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (ok) await removeSessionExercise(item.id);
  };

  const volume = totalVolume(sets);
  return (
    <section aria-labelledby={`pse-${item.id}`} className="overflow-hidden rounded-2xl bg-neutral-900">
      <header className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="min-w-0">
          <h2 id={`pse-${item.id}`} className="text-lg leading-tight font-bold">
            <Link to={`/progreso/ejercicio/${exercise.id}`} className="underline decoration-neutral-600 underline-offset-4">
              {exercise.name}
            </Link>
          </h2>
          {volume > 0 && <p className="text-sm text-neutral-500">Volumen: {formatWeight(volume)} {exercise.unit}</p>}
        </div>
      </header>
      <div className="px-3 pt-2">
        <label htmlFor={`pnotes-${item.id}`} className="sr-only">
          Notas de {exercise.name}
        </label>
        <input
          id={`pnotes-${item.id}`}
          placeholder="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => updateSessionExerciseNotes(item.id, notes)}
          className="h-12 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-base outline-none focus:border-accent"
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 px-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        <span className="text-center">
          {exercise.isBodyweight ? 'Lastre' : 'Peso'} ({exercise.unit})
        </span>
        <span className="text-center">Reps</span>
      </div>
      <ul className="divide-y divide-neutral-800">
        {sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            exercise={exercise}
            prs={[]}
            weightStep={settings.weightIncrement}
            info={
              set.isWarmup
                ? 'Calentamiento'
                : set.reps > 0 && !exercise.isBodyweight
                  ? `1RM estimado: ${formatWeight(Math.round(epley1RM(set.weight, set.reps) * 10) / 10)} ${exercise.unit}`
                  : ''
            }
          />
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2 p-3">
        <Button onClick={() => addSet(item.id, { done: true })}>
          <PlusIcon /> Serie
        </Button>
        <Button variant="ghost" className="text-red-300" onClick={onRemove}>
          Quitar ejercicio
        </Button>
      </div>
    </section>
  );
}
