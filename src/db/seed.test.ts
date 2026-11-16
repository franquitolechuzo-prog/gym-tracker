import { afterEach, describe, expect, it } from 'vitest';
import { GymDB } from './db';
import { ensureSeeded, SEED_EXERCISES, SEED_ROUTINES } from './seed';
import { getSettings } from './settings';

let database: GymDB;
let counter = 0;

function freshDb() {
  database = new GymDB(`test-${Date.now()}-${counter++}`);
  return database;
}

afterEach(async () => {
  await database?.delete();
});

describe('ensureSeeded', () => {
  it('loads default exercises, routines and settings once', async () => {
    const d = freshDb();
    expect(await ensureSeeded(d)).toBe(true);
    expect(await ensureSeeded(d)).toBe(false);

    expect(await d.exercises.count()).toBe(SEED_EXERCISES.length);
    expect(await d.routines.count()).toBe(SEED_ROUTINES.length);
    const totalRoutineExercises = SEED_ROUTINES.reduce((n, r) => n + r.exercises.length, 0);
    expect(await d.routineExercises.count()).toBe(totalRoutineExercises);
    expect(await getSettings(d)).toEqual({ unit: 'kg', weightIncrement: 2.5, defaultRestSeconds: 120 });
  });

  it('preserves routine order and exercise references', async () => {
    const d = freshDb();
    await ensureSeeded(d);
    const tiron = await d.routines.filter((r) => r.name === 'Tirón').first();
    expect(tiron).toBeDefined();
    const items = await d.routineExercises.where('routineId').equals(tiron!.id).sortBy('order');
    const names = await Promise.all(items.map(async (i) => (await d.exercises.get(i.exerciseId))!.name));
    expect(names).toEqual(['Dominadas', 'Remo en máquina', 'Face pull', 'Curl inclinado', 'Extensiones de espalda', 'Stand calf raise']);
  });

  it('marks pull-ups and dips as bodyweight', async () => {
    const d = freshDb();
    await ensureSeeded(d);
    const bodyweight = (await d.exercises.toArray()).filter((e) => e.isBodyweight).map((e) => e.name).sort();
    expect(bodyweight).toEqual(['Dominadas', 'Fondos']);
  });

  it('does not re-seed after the user deletes everything', async () => {
    const d = freshDb();
    await ensureSeeded(d);
    await d.exercises.clear();
    await ensureSeeded(d);
    expect(await d.exercises.count()).toBe(0);
  });
});
