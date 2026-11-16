import { describe, expect, it } from 'vitest';
import { formatRelativeDay, formatWeight, matchesSearch, normalizeText, parseDecimal, toLocalDateString } from './format';

describe('parseDecimal', () => {
  it.each([
    ['12,5', 12.5],
    ['27.5', 27.5],
    [' 40 ', 40],
    ['-5', -5],
    ['0', 0],
    [',5', 0.5],
    ['10.', 10],
  ])('parses %j as %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '40kg', '1,2,3', '1.2.3', '--1'])('rejects %j', (input) => {
    expect(parseDecimal(input)).toBeNull();
  });

  it('passes finite numbers through', () => {
    expect(parseDecimal(7.5)).toBe(7.5);
    expect(parseDecimal(Number.NaN)).toBeNull();
    expect(parseDecimal(null)).toBeNull();
  });
});

describe('formatWeight', () => {
  it('uses a decimal comma and trims trailing zeros', () => {
    expect(formatWeight(12.5)).toBe('12,5');
    expect(formatWeight(80)).toBe('80');
  });
});

describe('search', () => {
  it('normalizes accents and case', () => {
    expect(normalizeText('Extensiones de CUÁDRICEPS')).toBe('extensiones de cuadriceps');
  });

  it('matches all terms ignoring accents', () => {
    expect(matchesSearch('Extensión de tríceps en polea', 'triceps polea')).toBe(true);
    expect(matchesSearch('Jalón al pecho', 'JALON')).toBe(true);
    expect(matchesSearch('Press plano', 'press inclinado')).toBe(false);
    expect(matchesSearch('Press plano', '   ')).toBe(true);
  });
});

describe('formatRelativeDay', () => {
  const today = new Date(2025, 10, 12, 20, 0);
  it.each([
    ['2025-11-12', 'hoy'],
    ['2025-11-11', 'ayer'],
    ['2025-11-05', 'hace 7 días'],
    ['2025-09-01', '01/09/2025'],
  ])('%s → %s', (date, expected) => {
    expect(formatRelativeDay(date, today)).toBe(expected);
  });
});

describe('toLocalDateString', () => {
  it('formats with zero padding', () => {
    expect(toLocalDateString(new Date(2025, 10, 3))).toBe('2025-11-03');
  });
});
