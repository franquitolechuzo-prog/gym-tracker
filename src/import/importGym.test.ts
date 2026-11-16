import { describe, expect, it } from 'vitest';
import { createTestDb } from '../test/db';
import { ensureSeeded } from '../db/seed';
import { getExerciseHistory, listSessionExercises, listSets } from '../db/sessions';
import { importGroups, suggestMapping, uniqueExerciseNames } from './importGym';
import type { ParsedGroup } from './gymSheet';

function group(id: string, sheet: string, date: string | undefined, exercises: [string, [number, number][], string[]?][]): ParsedGroup {
  return {
    id,
    sheet,
    firstRow: 1,
    lastRow: 1,
    dateRaw: '',
    date,
    dateStatus: date ? 'ok' : 'missing',
    exercises: exercises.map(([name, sets, notes = []]) => ({ name, sets: sets.map(([weight, reps]) => ({ weight, reps })), notes })),
  };
}

describe('importGroups', () => {
  it('maps names, merges groups by date, creates missing exercises and links routines by sheet name', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    const groups = [
      group('a', 'Piernas A', '2025-11-12', [
        ['squat machine', [[40, 10], [42.5, 8]]],
        ['Hip thrust', [[60, 10]], ['80 en prensa grande']],
      ]),
      group('b', 'Piernas A', '2025-11-12', [['Squat Machine', [[45, 6]]]]),
      group('c', 'Empuje', '2025-11-10', [['Press plano', [[50, 8]]]]),
    ];
    const names = uniqueExerciseNames(groups);
    expect(names).toEqual(['squat machine', 'Hip thrust', 'Press plano']);
    const mapping = suggestMapping(names, await d.exercises.toArray());
    expect(mapping.get('Hip thrust')).toEqual({ kind: 'new', muscleGroup: 'Otro' });
    mapping.set('Hip thrust', { kind: 'new', muscleGroup: 'Piernas' });

    const result = await importGroups(groups, mapping, { skipExistingDates: true }, d);
    expect(result).toEqual({ sessions: 2, sets: 5, exercisesCreated: 1, skippedDates: [] });

    const hip = (await d.exercises.filter((e) => e.name === 'Hip thrust').first())!;
    expect(hip.muscleGroup).toBe('Piernas');

    const squat = (await d.exercises.filter((e) => e.name === 'Squat machine').first())!;
    const history = await getExerciseHistory(squat.id, {}, d);
    expect(history).toHaveLength(1);
    expect(history[0].sets.map((s) => [s.setNumber, s.weight, s.reps])).toEqual([
      [1, 40, 10],
      [2, 42.5, 8],
      [3, 45, 6],
    ]);
    const piernasA = (await d.routines.filter((r) => r.name === 'Piernas A').first())!;
    expect(history[0].session.routineId).toBe(piernasA.id);

    const ses = await listSessionExercises(history[0].session.id, d);
    expect(ses[1].notes).toBe('80 en prensa grande');
    expect((await listSets(ses[1].id, d))[0].done).toBe(true);
  });

  it('skips dates that already have sessions when re-importing', async () => {
    const d = createTestDb();
    await ensureSeeded(d);
    const groups = [group('a', 'X', '2025-11-12', [['Press plano', [[50, 8]]]])];
    const mapping = suggestMapping(uniqueExerciseNames(groups), await d.exercises.toArray());
    await importGroups(groups, mapping, { skipExistingDates: true }, d);
    const again = await importGroups(groups, mapping, { skipExistingDates: true }, d);
    expect(again).toMatchObject({ sessions: 0, skippedDates: ['2025-11-12'] });
    expect(await d.sessions.count()).toBe(1);
  });

  it('refuses groups without a date', async () => {
    const d = createTestDb();
    await expect(importGroups([group('a', 'X', undefined, [['A', [[1, 1]]]])], new Map(), { skipExistingDates: false }, d)).rejects.toThrow(
      /sin fecha|no tienen fecha/,
    );
  });
});
