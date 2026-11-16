import { describe, expect, it } from 'vitest';
import { createTestDb } from '../test/db';
import { ensureSeeded } from './seed';
import {
  addExerciseToRoutine,
  createRoutine,
  deleteRoutine,
  duplicateRoutine,
  listRoutineExercises,
  removeRoutineExercise,
  reorderRoutineExercises,
  reorderRoutines,
  updateRoutineExercise,
} from './routines';

async function names(d: Awaited<ReturnType<typeof createTestDb>>) {
  return (await d.routines.orderBy('order').toArray()).map((r) => r.name);
}

describe('routines', () => {
  it('appends new routines at the end', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    await createRoutine('  Full body ', d);
    expect((await names(d)).at(-1)).toBe('Full body');
    await expect(createRoutine(' ', d)).rejects.toThrow();
  });

  it('duplicates a routine right after the original, copying its exercises', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    const tiron = (await d.routines.filter((r) => r.name === 'Tirón').first())!;
    const copy = await duplicateRoutine(tiron.id, d);
    expect(await names(d)).toEqual(['Piernas A', 'Piernas B', 'Tirón', 'Tirón (copia)', 'Empuje A', 'Empuje B']);
    const orig = await listRoutineExercises(tiron.id, d);
    const copied = await listRoutineExercises(copy.id, d);
    expect(copied.map((c) => c.exerciseId)).toEqual(orig.map((o) => o.exerciseId));
    const origIds = new Set(orig.map((o) => o.id));
    expect(copied.some((c) => origIds.has(c.id))).toBe(false);
  });

  it('reorders routines and deletes them with their exercises', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    const list = await d.routines.orderBy('order').toArray();
    await reorderRoutines(list.map((r) => r.id).reverse(), d);
    expect(await names(d)).toEqual(['Empuje B', 'Empuje A', 'Tirón', 'Piernas B', 'Piernas A']);
    const before = await d.routineExercises.count();
    await deleteRoutine(list[0].id, d);
    expect(await d.routines.count()).toBe(4);
    expect(await d.routineExercises.count()).toBe(before - 5);
  });

  it('adds, reorders and removes routine exercises keeping a dense order', async () => {
    const d = createTestDb();
    const r = await createRoutine('R', d);
    const a = await addExerciseToRoutine(r.id, 'ex-a', {}, d);
    const b = await addExerciseToRoutine(r.id, 'ex-b', { targetSets: 4 }, d);
    const c = await addExerciseToRoutine(r.id, 'ex-c', {}, d);
    expect(b.targetSets).toBe(4);
    expect(a.targetRepsMin).toBe(8);

    await reorderRoutineExercises([c.id, a.id, b.id], d);
    expect((await listRoutineExercises(r.id, d)).map((x) => x.exerciseId)).toEqual(['ex-c', 'ex-a', 'ex-b']);

    await removeRoutineExercise(c.id, d);
    const rest = await listRoutineExercises(r.id, d);
    expect(rest.map((x) => [x.exerciseId, x.order])).toEqual([
      ['ex-a', 0],
      ['ex-b', 1],
    ]);
  });

  it('keeps the rep range consistent when editing targets', async () => {
    const d = createTestDb();
    const r = await createRoutine('R', d);
    const it1 = await addExerciseToRoutine(r.id, 'ex', { targetRepsMin: 8, targetRepsMax: 12 }, d);
    await updateRoutineExercise(it1.id, { targetRepsMin: 15 }, d);
    expect(await d.routineExercises.get(it1.id)).toMatchObject({ targetRepsMin: 15, targetRepsMax: 15 });
    await updateRoutineExercise(it1.id, { targetRepsMax: 6 }, d);
    expect(await d.routineExercises.get(it1.id)).toMatchObject({ targetRepsMin: 6, targetRepsMax: 6 });
    await updateRoutineExercise(it1.id, { targetSets: 0 }, d);
    expect((await d.routineExercises.get(it1.id))?.targetSets).toBe(1);
  });
});
