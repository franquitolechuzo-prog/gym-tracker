import { db, type GymDB } from './db';
import type { Exercise } from './types';
import { newId } from '../lib/id';
import { normalizeText } from '../lib/format';

export type ExerciseInput = Pick<Exercise, 'name' | 'muscleGroup' | 'unit' | 'isBodyweight'> &
  Partial<Pick<Exercise, 'equipment' | 'notes'>>;

export class ValidationError extends Error {}

function clean(input: Partial<ExerciseInput>): Partial<ExerciseInput> {
  const out = { ...input };
  if (out.name !== undefined) out.name = out.name.trim().replace(/\s+/g, ' ');
  if (out.equipment !== undefined) out.equipment = out.equipment.trim() || undefined;
  if (out.notes !== undefined) out.notes = out.notes.trim() || undefined;
  return out;
}

/** Rejects empty names and names that collide with another active exercise (accent/case-insensitive). */
async function assertValidName(database: GymDB, name: string | undefined, ignoreId?: string) {
  if (!name) throw new ValidationError('El nombre es obligatorio.');
  const key = normalizeText(name);
  const clash = await database.exercises
    .filter((e) => !e.archived && e.id !== ignoreId && normalizeText(e.name) === key)
    .first();
  if (clash) throw new ValidationError(`Ya existe un ejercicio llamado "${clash.name}".`);
}

export async function createExercise(input: ExerciseInput, database: GymDB = db): Promise<Exercise> {
  const data = clean(input) as ExerciseInput;
  await assertValidName(database, data.name);
  const exercise: Exercise = { ...data, id: newId(), archived: false, createdAt: Date.now() };
  await database.exercises.add(exercise);
  return exercise;
}

export async function updateExercise(id: string, patch: Partial<ExerciseInput>, database: GymDB = db): Promise<void> {
  const data = clean(patch);
  if (data.name !== undefined) await assertValidName(database, data.name, id);
  await database.exercises.update(id, data);
}

export async function isExerciseInHistory(id: string, database: GymDB = db): Promise<boolean> {
  return (await database.sessionExercises.where('exerciseId').equals(id).count()) > 0;
}

/**
 * Removes an exercise. If it appears in any logged session it is archived instead, so history
 * stays intact. Unused exercises are deleted along with their routine entries.
 */
export async function deleteOrArchiveExercise(id: string, database: GymDB = db): Promise<'deleted' | 'archived'> {
  return database.transaction('rw', [database.exercises, database.sessionExercises, database.routineExercises], async () => {
    if (await isExerciseInHistory(id, database)) {
      await database.exercises.update(id, { archived: true });
      return 'archived' as const;
    }
    await database.routineExercises.where('exerciseId').equals(id).delete();
    await database.exercises.delete(id);
    return 'deleted' as const;
  });
}

export async function restoreExercise(id: string, database: GymDB = db): Promise<void> {
  const ex = await database.exercises.get(id);
  if (!ex) return;
  await assertValidName(database, ex.name, id);
  await database.exercises.update(id, { archived: false });
}
