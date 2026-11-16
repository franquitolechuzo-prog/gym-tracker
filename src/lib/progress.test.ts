import { describe, expect, it } from 'vitest';
import { alignWithPrevious, compareToPrevious, computeRecords, detectPRs, formatSet, mergeRecords, planSets } from './progress';

const w = (weight: number, reps: number, isWarmup = false) => ({ weight, reps, isWarmup });

describe('compareToPrevious', () => {
  it('treats more weight, or more reps at the same weight, as better', () => {
    expect(compareToPrevious(w(27.5, 3), w(25, 5))).toBe('better');
    expect(compareToPrevious(w(25, 6), w(25, 5))).toBe('better');
    expect(compareToPrevious(w(25, 5), w(25, 5))).toBe('equal');
    expect(compareToPrevious(w(25, 4), w(25, 5))).toBe('worse');
    expect(compareToPrevious(w(22.5, 10), w(25, 5))).toBe('worse');
  });

  it('returns undefined without a previous set or with zero reps', () => {
    expect(compareToPrevious(w(25, 5))).toBeUndefined();
    expect(compareToPrevious(w(30, 0), w(25, 5))).toBeUndefined();
  });
});

describe('alignWithPrevious', () => {
  it('matches warm-ups with warm-ups and working sets with working sets', () => {
    const prev = [w(20, 10, true), w(40, 8), w(40, 7)];
    const cur = [w(20, 10, true), w(20, 10, true), w(40, 8), w(40, 8), w(40, 8)];
    expect(alignWithPrevious(cur, prev)).toEqual([prev[0], undefined, prev[1], prev[2], undefined]);
  });
});

describe('records', () => {
  const history = [w(20, 12, true), w(80, 6), w(80, 8), w(85, 4), w(70, 10)];

  it('computes max weight, best e1RM and best reps per weight, ignoring warm-ups', () => {
    const r = computeRecords(history);
    expect(r.maxWeight).toBe(85);
    expect(r.best1RM).toBeCloseTo(80 * (1 + 8 / 30));
    expect(r.maxRepsByWeight.get(80)).toBe(8);
    expect(r.maxRepsByWeight.has(20)).toBe(false);
  });

  it('detects weight, reps and e1RM PRs', () => {
    const r = computeRecords(history);
    expect(detectPRs(w(87.5, 1), r)).toEqual(['weight']);
    expect(detectPRs(w(80, 9), r)).toEqual(['reps', '1rm']);
    expect(detectPRs(w(70, 11), r)).toEqual(['reps']);
    expect(detectPRs(w(80, 8), r)).toEqual([]);
    expect(detectPRs(w(100, 5, true), r)).toEqual([]);
  });

  it('reports no PRs without history', () => {
    expect(detectPRs(w(100, 5), computeRecords([]))).toEqual([]);
  });

  it('merges new sets into existing records', () => {
    const r = mergeRecords(computeRecords(history), [w(90, 2)]);
    expect(r.maxWeight).toBe(90);
    expect(detectPRs(w(90, 2), r)).toEqual([]);
  });
});

describe('formatSet', () => {
  it('formats regular and bodyweight sets', () => {
    expect(formatSet(27.5, 5, 'kg')).toBe('27,5 kg × 5');
    expect(formatSet(0, 8, 'kg', true)).toBe('PC × 8');
    expect(formatSet(10, 6, 'kg', true)).toBe('PC +10 kg × 6');
    expect(formatSet(-15, 5, 'kg', true)).toBe('PC −15 kg × 5');
  });
});

describe('planSets', () => {
  it('copies last session and tops up to the target with the last working set', () => {
    expect(planSets([w(20, 10, true), w(40, 8)], { targetSets: 3 })).toEqual([w(20, 10, true), w(40, 8), w(40, 8), w(40, 8)]);
  });

  it('keeps extra sets done last time', () => {
    expect(planSets([w(40, 8), w(40, 8), w(40, 8), w(40, 6)], { targetSets: 3 })).toHaveLength(4);
  });

  it('uses the routine target when there is no history', () => {
    expect(planSets(undefined, { targetSets: 2, targetRepsMin: 6 })).toEqual([w(0, 6), w(0, 6)]);
    expect(planSets([])).toEqual([w(0, 0), w(0, 0), w(0, 0)]);
  });
});
