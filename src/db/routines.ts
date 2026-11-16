import { db, type GymDB } from './db';
import type { Routine, RoutineExercise } from './types';
import { newId } from '../lib/id';
import { ValidationError } from './exercises';

export const DEFAULT_TARGET = { targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 } as const;

export type RoutineExerciseTargets = Partial<
  Pick<RoutineExercise, 'targetSets' | 'targetRepsMin' | 'targetRepsMax' | 'restSeconds'>
>;

export async function listRoutineExercises(routineId: string, database: GymDB = db): Promise<RoutineExercise[]> {
  return database.routineExercises.where('[routineId+order]').between([routineId, -Infinity], [routineId, Infinity]).toArray();
}

export async function createRoutine(name: string, database: GymDB = db): Promise<Routine> {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError('El nombre es obligatorio.');
  const last = await database.routines.orderBy('order').last();
  const routine: Routine = { id: newId(), name: trimmed, order: (last?.order ?? -1) + 1, createdAt: Date.now() };
  await database.routines.add(routine);
  return routine;
}

export async function updateRoutine(id: string, patch: Partial<Pick<Routine, 'name' | 'notes'>>, database: GymDB = db) {
  const data = { ...patch };
  if (data.name !== undefined) {
    data.name = data.name.trim();
    if (!data.name) throw new ValidationError('El nombre es obligatorio.');
  }
  if (data.notes !== undefined) data.notes = data.notes.trim() || undefined;
  await database.routines.update(id, data);
}

/** Copies a routine and its exercises; the copy is placed right after the original. */
export async function duplicateRoutine(id: string, database: GymDB = db): Promise<Routine> {
  return database.transaction('rw', [database.routines, database.routineExercises], async () => {
    const source = await database.routines.get(id);
    if (!source) throw new Error(`Routine ${id} not found`);
    const all = await database.routines.orderBy('order').toArray();
    const copy: Routine = { ...source, id: newId(), name: `${source.name} (copia)`, createdAt: Date.now() };
    const idx = all.findIndex((r) => r.id === id);
    all.splice(idx + 1, 0, copy);
    await database.routines.add(copy);
    await Promise.all(all.map((r, order) => database.routines.update(r.id, { order })));
    const items = await listRoutineExercises(id, database);
    await database.routineExercises.bulkAdd(items.map((it) => ({ ...it, id: newId(), routineId: copy.id })));
    return { ...copy, order: idx + 1 };
  });
}

/** Deletes a routine and its exercise list. Past sessions keep their data (routineId becomes dangling). */
export async function deleteRoutine(id: string, database: GymDB = db): Promise<void> {
  await database.transaction('rw', [database.routines, database.routineExercises], async () => {
    await database.routineExercises.where('routineId').equals(id).delete();
    await database.routines.delete(id);
  });
}

/** Persists a new routine order given the ids in display order. */
export async function reorderRoutines(orderedIds: string[], database: GymDB = db): Promise<void> {
  await database.transaction('rw', database.routines, async () => {
    await Promise.all(orderedIds.map((id, order) => database.routines.update(id, { order })));
  });
}

export async function addExerciseToRoutine(
  routineId: string,
  exerciseId: string,
  targets: RoutineExerciseTargets = {},
  database: GymDB = db,
): Promise<RoutineExercise> {
  return database.transaction('rw', database.routineExercises, async () => {
    const items = await listRoutineExercises(routineId, database);
    const item: RoutineExercise = {
      ...DEFAULT_TARGET,
      ...targets,
      id: newId(),
      routineId,
      exerciseId,
      order: (items.at(-1)?.order ?? -1) + 1,
    };
    await database.routineExercises.add(item);
    return item;
  });
}

export async function updateRoutineExercise(id: string, patch: RoutineExerciseTargets, database: GymDB = db) {
  const data = { ...patch };
  if (data.targetSets !== undefined) data.targetSets = Math.max(1, Math.round(data.targetSets));
  // Keep min <= max when both are set.
  const current = await database.routineExercises.get(id);
  if (!current) return;
  const min = data.targetRepsMin ?? current.targetRepsMin;
  const max = data.targetRepsMax ?? current.targetRepsMax;
  if (min !== undefined && max !== undefined && min > max) {
    if ('targetRepsMin' in data) data.targetRepsMax = min;
    else data.targetRepsMin = max;
  }
  await database.routineExercises.update(id, data);
}

export async function removeRoutineExercise(id: string, database: GymDB = db): Promise<void> {
  await database.transaction('rw', database.routineExercises, async () => {
    const item = await database.routineExercises.get(id);
    if (!item) return;
    await database.routineExercises.delete(id);
    const rest = await listRoutineExercises(item.routineId, database);
    await Promise.all(rest.map((r, order) => database.routineExercises.update(r.id, { order })));
  });
}

export async function reorderRoutineExercises(orderedIds: string[], database: GymDB = db): Promise<void> {
  await database.transaction('rw', database.routineExercises, async () => {
    await Promise.all(orderedIds.map((id, order) => database.routineExercises.update(id, { order })));
  });
}
