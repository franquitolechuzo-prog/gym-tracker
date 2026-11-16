import { describe, expect, it } from 'vitest';
import { createTestDb } from '../test/db';
import { createExercise, deleteOrArchiveExercise, restoreExercise, updateExercise } from './exercises';
import { addExerciseToRoutine, createRoutine } from './routines';

const base = { muscleGroup: 'Pecho', unit: 'kg', isBodyweight: false } as const;

describe('exercises', () => {
  it('creates with trimmed fields and rejects duplicate names ignoring accents/case', async () => {
    const d = createTestDb();
    const ex = await createExercise({ ...base, name: '  Press   declinado ', equipment: '  ' }, d);
    expect(ex.name).toBe('Press declinado');
    expect(ex.equipment).toBeUndefined();
    await expect(createExercise({ ...base, name: 'PRÉSS DECLINADO' }, d)).rejects.toThrow(/Ya existe/);
    await expect(createExercise({ ...base, name: '   ' }, d)).rejects.toThrow(/obligatorio/);
  });

  it('allows renaming to its own name but not to another one', async () => {
    const d = createTestDb();
    const a = await createExercise({ ...base, name: 'A' }, d);
    await createExercise({ ...base, name: 'B' }, d);
    await expect(updateExercise(a.id, { name: 'a' }, d)).resolves.toBeUndefined();
    await expect(updateExercise(a.id, { name: 'b' }, d)).rejects.toThrow(/Ya existe/);
  });

  it('deletes unused exercises together with their routine entries', async () => {
    const d = createTestDb();
    const ex = await createExercise({ ...base, name: 'A' }, d);
    const r = await createRoutine('R', d);
    await addExerciseToRoutine(r.id, ex.id, {}, d);
    expect(await deleteOrArchiveExercise(ex.id, d)).toBe('deleted');
    expect(await d.exercises.get(ex.id)).toBeUndefined();
    expect(await d.routineExercises.count()).toBe(0);
  });

  it('archives exercises that appear in history and keeps their data', async () => {
    const d = createTestDb();
    const ex = await createExercise({ ...base, name: 'A' }, d);
    await d.sessionExercises.add({ id: 'se1', sessionId: 's1', exerciseId: ex.id, order: 0 });
    expect(await deleteOrArchiveExercise(ex.id, d)).toBe('archived');
    expect((await d.exercises.get(ex.id))?.archived).toBe(true);
    expect(await d.sessionExercises.count()).toBe(1);

    // An archived name can be reused, and then the archived one can't be restored.
    const clone = await createExercise({ ...base, name: 'A' }, d);
    await expect(restoreExercise(ex.id, d)).rejects.toThrow(/Ya existe/);
    await deleteOrArchiveExercise(clone.id, d);
    await restoreExercise(ex.id, d);
    expect((await d.exercises.get(ex.id))?.archived).toBe(false);
  });
});
