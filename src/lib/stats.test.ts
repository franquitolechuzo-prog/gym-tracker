import { describe, expect, it } from 'vitest';
import { exerciseSeries, recordsDetail, suggestProgression } from './stats';

const s = (weight: number, reps: number, isWarmup = false) => ({ weight, reps, isWarmup });

const history = [
  { date: '2025-11-12', sets: [s(20, 10, true), s(27.5, 5), s(27.5, 4)] },
  { date: '2025-11-05', sets: [s(25, 5), s(25, 5), s(25, 6)] },
  { date: '2025-11-08', sets: [s(20, 10, true)] },
];

describe('exerciseSeries', () => {
  it('builds per-session max weight, e1RM and volume, oldest first, ignoring warm-ups', () => {
    const series = exerciseSeries(history);
    expect(series.map((p) => p.date)).toEqual(['2025-11-05', '2025-11-12']);
    expect(series[0]).toMatchObject({ maxWeight: 25, volume: 25 * 16 });
    expect(series[0].best1RM).toBeCloseTo(25 * (1 + 6 / 30));
    expect(series[1]).toMatchObject({ maxWeight: 27.5, volume: 27.5 * 9 });
  });
});

describe('recordsDetail', () => {
  it('reports each record with the date it was first set', () => {
    const r = recordsDetail(history);
    expect(r.maxWeight).toEqual({ weight: 27.5, reps: 5, date: '2025-11-12' });
    expect(r.best1RM).toMatchObject({ weight: 27.5, reps: 5, date: '2025-11-12' });
    expect(r.repsByWeight).toEqual([
      { weight: 27.5, reps: 5, date: '2025-11-12' },
      { weight: 25, reps: 6, date: '2025-11-05' },
    ]);
  });

  it('is empty without working sets', () => {
    expect(recordsDetail([{ date: '2025-01-01', sets: [s(20, 10, true)] }])).toEqual({ repsByWeight: [] });
  });
});

describe('suggestProgression', () => {
  const target = { targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 };

  it('suggests one increment more when all working sets hit the top of the range', () => {
    expect(suggestProgression([s(20, 15, true), s(40, 12), s(40, 12), s(40, 13)], target, 2.5)).toMatchObject({ weight: 42.5 });
  });

  it('does not suggest when a set fell short, sets are missing, or there is no rep target', () => {
    expect(suggestProgression([s(40, 12), s(40, 11), s(40, 12)], target, 2.5)).toBeUndefined();
    expect(suggestProgression([s(40, 12), s(40, 12)], target, 2.5)).toBeUndefined();
    expect(suggestProgression([s(40, 12), s(40, 12), s(40, 12)], { targetSets: 3 }, 2.5)).toBeUndefined();
    expect(suggestProgression(undefined, target, 2.5)).toBeUndefined();
  });
});
