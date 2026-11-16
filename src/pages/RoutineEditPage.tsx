import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/Layout';
import { SortableList } from '../components/SortableList';
import { ExercisePicker } from '../components/ExercisePicker';
import { Button, Field, NumberStepper, inputClass } from '../components/ui';
import { useConfirm } from '../components/confirm';
import { ChevronIcon, PlusIcon } from '../components/icons';
import { db } from '../db/db';
import type { Exercise, RoutineExercise } from '../db/types';
import {
  addExerciseToRoutine,
  deleteRoutine,
  duplicateRoutine,
  listRoutineExercises,
  removeRoutineExercise,
  reorderRoutineExercises,
  updateRoutine,
  updateRoutineExercise,
} from '../db/routines';
import { useSettings } from '../db/settings';

export function RoutineEditPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const isNew = params.has('nueva');
  const navigate = useNavigate();
  const confirm = useConfirm();

  const routine = useLiveQuery(async () => (await db.routines.get(id)) ?? null, [id]);
  const items = useLiveQuery(() => listRoutineExercises(id), [id]);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (routine && !loaded) {
      setName(routine.name);
      setNotes(routine.notes ?? '');
      setLoaded(true);
    }
  }, [routine, loaded]);

  if (routine === null) {
    return (
      <>
        <PageHeader title="Rutina" back />
        <p className="p-4 text-neutral-500">Esta rutina no existe.</p>
      </>
    );
  }
  if (!routine || !items || !exercises) return <PageHeader title="Rutina" back />;

  const saveName = async () => {
    if (!name.trim()) {
      setNameError(true);
      setName(routine.name);
      return;
    }
    setNameError(false);
    if (name.trim() !== routine.name) await updateRoutine(id, { name });
  };

  const onDuplicate = async () => {
    const copy = await duplicateRoutine(id);
    navigate(`/rutinas/${copy.id}`, { replace: true });
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `¿Eliminar "${routine.name}"?`,
      message: 'Se borra la rutina. Las sesiones que ya registraste con ella se conservan.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    await deleteRoutine(id);
    navigate('/rutinas', { replace: true });
  };

  return (
    <>
      <PageHeader title={routine.name} back />
      <div className="flex flex-col gap-4 p-4">
        <Field label="Nombre" htmlFor="routine-name" hint={nameError ? 'El nombre no puede quedar vacío.' : undefined}>
          <input
            id="routine-name"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onFocus={(e) => isNew && e.currentTarget.select()}
            autoFocus={isNew}
            enterKeyHint="done"
          />
        </Field>
        <Field label="Notas (opcional)" htmlFor="routine-notes">
          <textarea
            id="routine-notes"
            rows={2}
            className={`${inputClass} h-auto py-3`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (routine.notes ?? '') && updateRoutine(id, { notes })}
          />
        </Field>
      </div>

      <h2 className="px-4 pb-2 text-sm font-semibold tracking-wide text-neutral-400 uppercase">
        Ejercicios ({items.length})
      </h2>
      {items.length === 0 && <p className="px-4 pb-4 text-neutral-500">Agregá ejercicios a esta rutina.</p>}
      <SortableList
        items={items}
        onReorder={reorderRoutineExercises}
        className="divide-y divide-neutral-900 border-y border-neutral-900"
        renderItem={(item, handle) => (
          <RoutineExerciseRow
            item={item}
            exercise={exercises.get(item.exerciseId)}
            handle={handle}
            expanded={expanded === item.id}
            onToggle={() => setExpanded((cur) => (cur === item.id ? null : item.id))}
          />
        )}
      />

      <div className="flex flex-col gap-3 p-4">
        <Button variant="primary" onClick={() => setPicking(true)}>
          <PlusIcon /> Agregar ejercicio
        </Button>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={onDuplicate}>Duplicar</Button>
          <Button variant="danger" onClick={onDelete}>
            Eliminar
          </Button>
        </div>
      </div>

      {picking && (
        <ExercisePicker
          multiple
          selectedIds={items.map((i) => i.exerciseId)}
          onPick={(exerciseId) => addExerciseToRoutine(id, exerciseId)}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

function formatTargets(item: RoutineExercise): string {
  const { targetSets, targetRepsMin: min, targetRepsMax: max, restSeconds } = item;
  let reps = '';
  if (min !== undefined && max !== undefined) reps = min === max ? `${min}` : `${min}–${max}`;
  else if (min !== undefined || max !== undefined) reps = `${min ?? max}`;
  const parts = [reps ? `${targetSets} × ${reps}` : `${targetSets} series`];
  if (restSeconds) parts.push(formatRest(restSeconds));
  return parts.join(' · ');
}

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`;
}

function RoutineExerciseRow({
  item,
  exercise,
  handle,
  expanded,
  onToggle,
}: {
  item: RoutineExercise;
  exercise: Exercise | undefined;
  handle: ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const settings = useSettings();
  const update = (patch: Parameters<typeof updateRoutineExercise>[1]) => updateRoutineExercise(item.id, patch);
  const panelId = `re-${item.id}`;

  return (
    <div>
      <div className="flex items-center pl-1">
        {handle}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-2 py-2 pr-4 text-left active:bg-neutral-900"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {exercise?.name ?? 'Ejercicio eliminado'}
              {exercise?.archived && <span className="text-neutral-500"> (archivado)</span>}
            </span>
            <span className="block text-sm text-neutral-500">{formatTargets(item)}</span>
          </span>
          <ChevronIcon className={`text-neutral-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>
      {expanded && (
        <div id={panelId} className="grid grid-cols-2 gap-3 bg-neutral-900/50 p-4">
          <NumberStepper compact label="Series" value={item.targetSets} min={1} max={20} onChange={(v) => update({ targetSets: v ?? 1 })} />
          <NumberStepper
            compact
            optional
            label="Descanso (s)"
            step={15}
            min={0}
            max={900}
            value={item.restSeconds ?? settings.defaultRestSeconds}
            onChange={(v) => update({ restSeconds: v })}
          />
          <NumberStepper compact optional label="Reps mín." min={1} max={100} value={item.targetRepsMin} onChange={(v) => update({ targetRepsMin: v })} />
          <NumberStepper compact optional label="Reps máx." min={1} max={100} value={item.targetRepsMax} onChange={(v) => update({ targetRepsMax: v })} />
          <Button variant="ghost" className="col-span-2 text-red-300" onClick={() => removeRoutineExercise(item.id)}>
            Quitar de la rutina
          </Button>
        </div>
      )}
    </div>
  );
}
