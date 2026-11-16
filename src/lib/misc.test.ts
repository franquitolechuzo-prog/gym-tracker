import { describe, expect, it } from 'vitest';
import { formatClock } from '../features/session/restTimer';
import { formatBytes } from './storage';
import { formatLongDate, formatShortDate } from './format';
import { newId } from './id';

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [90, '1:30'],
    [150.4, '2:30'],
    [3725, '1:02:05'],
    [-3, '0:00'],
  ])('%d s → %s', (s, expected) => {
    expect(formatClock(s)).toBe(expected);
  });
});

describe('formatBytes', () => {
  it('uses B, KB and MB with a decimal comma', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(150 * 1024)).toBe('150 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2,5 MB');
  });
});

describe('dates', () => {
  it('formats in Spanish (Argentina)', () => {
    expect(formatShortDate('2025-11-03')).toBe('3/11');
    expect(formatShortDate('2025-01-25')).toBe('25/1');
    expect(formatLongDate('2025-11-12')).toMatch(/mi[eé].*12.*nov.*2025/);
  });
});

describe('newId', () => {
  it('produces unique RFC 4122 v4 ids', () => {
    const ids = new Set(Array.from({ length: 500 }, newId));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
