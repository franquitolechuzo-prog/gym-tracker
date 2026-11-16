import { describe, expect, it } from 'vitest';
import { createTestDb } from '../test/db';
import { ensureSeeded } from './seed';
import { exportBackup, exportHistoryCsv, parseBackup, resetDatabase, restoreBackup, summarizeBackup } from './backup';
import { finishSession, listSessionExercises, listSets, startSession, updateSet } from './sessions';
import type { GymDB } from './db';

async function logOne(d: GymDB) {
  const r = (await d.routines.filter((x) => x.name === 'Tirón').first())!;
  const s = await startSession(r.id, d, new Date(2025, 10, 12, 18).getTime());
  const [se] = await listSessionExercises(s.id, d);
  const sets = await listSets(se.id, d);
  await updateSet(sets[0].id, { weight: 12.5, reps: 6, done: true }, d);
  await updateSet(sets[1].id, { weight: 0, reps: 8, done: true, isWarmup: true }, d);
  await d.sessionExercises.update(se.id, { notes: 'agarre "neutro"; lento' });
  await finishSession(s.id, d);
  return s;
}

describe('backup', () => {
  it('round-trips the whole database through JSON', async () => {
    const a = createTestDb();
    await ensureSeeded(a);
    await logOne(a);
    await a.kv.put({ key: 'restTimer', value: { endsAt: 1 } });
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportBackup(a))));
    expect(backup.data.kv.some((k) => k.key === 'restTimer')).toBe(false);
    expect(summarizeBackup(backup)).toMatchObject({ exercises: 27, routines: 5, sessions: 1, firstDate: '2025-11-12' });

    const b = createTestDb();
    await ensureSeeded(b);
    await b.exercises.add({ id: 'extra', name: 'X', muscleGroup: 'Otro', unit: 'kg', isBodyweight: false, archived: false, createdAt: 0 });
    await restoreBackup(backup, b);
    expect(await b.exercises.count()).toBe(27);
    expect(await b.sets.count()).toBe(await a.sets.count());
    expect(await b.sessions.toArray()).toEqual(await a.sessions.toArray());
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup({ foo: 1 })).toThrow(/no es un respaldo/);
    expect(() => parseBackup({ format: 'gym-tracker-backup', version: 99, data: {} })).toThrow(/más nueva/);
    expect(() => parseBackup({ format: 'gym-tracker-backup', version: 1, data: { exercises: [] } })).toThrow(/incompleto/);
  });

  it('resets to the default first-launch state', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    await logOne(d);
    await resetDatabase(d);
    expect(await d.sessions.count()).toBe(0);
    expect(await d.exercises.count()).toBe(27);
    expect(await d.routines.count()).toBe(5);
  });
});

describe('exportHistoryCsv', () => {
  it('writes one row per logged set with Spanish number format and quoting', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    await logOne(d);
    const csv = await exportHistoryCsv(d);
    expect(csv.startsWith('﻿Fecha;Rutina;Ejercicio')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('2025-11-12;Tirón;Dominadas;Espalda;1;12,5;kg;6;no;15;"agarre ""neutro""; lento";');
    expect(lines[2]).toContain(';2;0;kg;8;sí;;');
  });
});
