import { describe, expect, it } from 'vitest';
import { epley1RM, totalVolume } from './strength';

describe('epley1RM', () => {
  it('applies weight × (1 + reps/30)', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 2);
    expect(epley1RM(25, 5)).toBeCloseTo(29.1667, 3);
  });

  it('returns the weight for a single rep and 0 for no reps', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 0)).toBe(0);
  });
});

describe('totalVolume', () => {
  it('sums weight × reps excluding warm-ups', () => {
    expect(
      totalVolume([
        { weight: 20, reps: 10, isWarmup: true },
        { weight: 40, reps: 8, isWarmup: false },
        { weight: 42.5, reps: 6, isWarmup: false },
      ]),
    ).toBe(40 * 8 + 42.5 * 6);
  });
});
