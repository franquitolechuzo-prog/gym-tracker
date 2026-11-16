import { describe, expect, it } from 'vitest';
import { createTestDb } from '../test/db';
import type { GymDB } from './db';
import { ensureSeeded } from './seed';
import {
  addExerciseToSession,
  addSet,
  deleteSession,
  finishSession,
  getActiveSession,
  getExerciseHistory,
  getPreviousSets,
  listSessionExercises,
  listSets,
  moveSessionExercise,
  removeSet,
  replaceSessionExercise,
  startSession,
  updateSet,
} from './sessions';

const DAY = 86_400_000;
const T0 = new Date(2025, 10, 11, 18, 0).getTime();

async function routineByName(d: GymDB, name: string) {
  return (await d.routines.filter((r) => r.name === name).first())!;
}
async function exerciseByName(d: GymDB, name: string) {
  return (await d.exercises.filter((e) => e.name === name).first())!;
}

/** Starts a routine session, sets each exercise's sets and marks them done, then finishes it. */
async function logRoutine(d: GymDB, routine: string, at: number, values: [number, number][]) {
  const r = await routineByName(d, routine);
  const s = await startSession(r.id, d, at);
  for (const se of await listSessionExercises(s.id, d)) {
    const sets = await listSets(se.id, d);
    for (const [i, set] of sets.entries()) {
      const [weight, reps] = values[i] ?? values.at(-1)!;
      await updateSet(set.id, { weight, reps, done: true }, d);
    }
  }
  await finishSession(s.id, d, at + 3_600_000);
  return s;
}

describe('sessions', () => {
  it('starts a routine session with target sets when there is no history', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    const s = await startSession((await routineByName(d, 'Piernas A')).id, d, T0);
    expect(s.date).toBe('2025-11-11');
    expect(await getActiveSession(d)).toMatchObject({ id: s.id });
    const ses = await listSessionExercises(s.id, d);
    expect(ses).toHaveLength(5);
    const first = await listSets(ses[0].id, d);
    expect(first).toHaveLength(3);
    expect(first[0]).toMatchObject({ setNumber: 1, weight: 0, reps: 6, done: false, isWarmup: false });
  });

  it('pre-fills from the previous session of each exercise', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    await logRoutine(d, 'Piernas A', T0, [
      [25, 5],
      [27.5, 5],
      [27.5, 4],
    ]);
    // Piernas B shares "Peso muerto" with Piernas A.
    const s = await startSession((await routineByName(d, 'Piernas B')).id, d, T0 + DAY);
    const deadlift = await exerciseByName(d, 'Peso muerto');
    const se = (await listSessionExercises(s.id, d)).find((x) => x.exerciseId === deadlift.id)!;
    const sets = await listSets(se.id, d);
    expect(sets.map((x) => [x.weight, x.reps, x.done])).toEqual([
      [25, 5, false],
      [27.5, 5, false],
      [27.5, 4, false],
    ]);
    // The active session itself is not "previous".
    expect((await getPreviousSets(deadlift.id, s, d))?.map((x) => x.weight)).toEqual([25, 27.5, 27.5]);
  });

  it('ignores unfinished sessions and later sessions in history', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    const first = await logRoutine(d, 'Tirón', T0, [[10, 8]]);
    await logRoutine(d, 'Tirón', T0 + 2 * DAY, [[12.5, 8]]);
    await startSession((await routineByName(d, 'Tirón')).id, d, T0 + 3 * DAY); // active
    const pullups = await exerciseByName(d, 'Dominadas');

    const history = await getExerciseHistory(pullups.id, {}, d);
    expect(history.map((h) => h.sets[0].weight)).toEqual([12.5, 10]);
    const before = await getExerciseHistory(pullups.id, { before: T0 + DAY }, d);
    expect(before.map((h) => h.session.id)).toEqual([first.id]);
  });

  it('adds, removes and renumbers sets', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    const s = await startSession(undefined, d, T0);
    const se = await addExerciseToSession(s.id, (await exerciseByName(d, 'Press plano')).id, d);
    let sets = await listSets(se.id, d);
    expect(sets).toHaveLength(3);
    await updateSet(sets[2].id, { weight: 60, reps: 8 }, d);
    const added = await addSet(se.id, {}, d);
    expect(added).toMatchObject({ setNumber: 4, weight: 60, reps: 8, done: false });
    await removeSet(sets[0].id, d);
    sets = await listSets(se.id, d);
    expect(sets.map((x) => x.setNumber)).toEqual([1, 2, 3]);
  });

  it('replaces and reorders session exercises', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    await logRoutine(d, 'Empuje B', T0, [[50, 8]]);
    const s = await startSession((await routineByName(d, 'Empuje A')).id, d, T0 + DAY);
    const [first, second] = await listSessionExercises(s.id, d);
    const flat = await exerciseByName(d, 'Press plano');
    await replaceSessionExercise(first.id, flat.id, d);
    const sets = await listSets(first.id, d);
    expect(sets.every((x) => x.weight === 50 && !x.done)).toBe(true);

    await moveSessionExercise(second.id, -1, d);
    expect((await listSessionExercises(s.id, d)).map((x) => x.id).slice(0, 2)).toEqual([second.id, first.id]);
  });

  it('finishing discards unchecked sets and empty exercises', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    const s = await startSession((await routineByName(d, 'Piernas A')).id, d, T0);
    const [a, b] = await listSessionExercises(s.id, d);
    const aSets = await listSets(a.id, d);
    await updateSet(aSets[1].id, { weight: 40, reps: 10, done: true }, d);

    expect(await finishSession(s.id, d, T0 + 1000)).toBe('saved');
    expect(await getActiveSession(d)).toBeUndefined();
    const ses = await listSessionExercises(s.id, d);
    expect(ses.map((x) => x.id)).toEqual([a.id]);
    expect((await listSets(a.id, d)).map((x) => [x.setNumber, x.weight])).toEqual([[1, 40]]);
    expect(await listSets(b.id, d)).toEqual([]);
  });

  it('finishing a session with nothing done deletes it', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    const s = await startSession((await routineByName(d, 'Piernas A')).id, d, T0);
    expect(await finishSession(s.id, d)).toBe('discarded');
    expect(await d.sessions.count()).toBe(0);
    expect(await d.sessionExercises.count()).toBe(0);
    expect(await d.sets.count()).toBe(0);
  });

  it('deletes a session with all its data', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    const s = await logRoutine(d, 'Tirón', T0, [[10, 8]]);
    await deleteSession(s.id, d);
    expect(await d.sessions.count()).toBe(0);
    expect(await d.sets.count()).toBe(0);
  });
});
