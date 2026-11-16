import { describe, expect, it } from 'vitest';
import { parseGymSheet, parseRepsCell, parseSheetDate, parseWeightCell, type Cell } from './gymSheet';

const today = new Date(2025, 10, 16); // 16/11/2025

describe('parseSheetDate', () => {
  it.each<[Cell, string]>([
    [1211, '2025-11-12'],
    ['1111', '2025-11-11'],
    [511, '2025-11-05'],
    ['12/11', '2025-11-12'],
    ['3/2/24', '2024-02-03'],
    [2512, '2024-12-25'], // 25/12 is after "today", so it belongs to last year
    [45973, '2025-11-12'], // Excel serial
    ['45973', '2025-11-12'],
    ['2025-11-12T03:00:00.000Z', '2025-11-12'],
  ])('%j → %s', (input, expected) => {
    expect(parseSheetDate(input, today)).toMatchObject({ date: expected, status: 'ok' });
  });

  it('uses the anchor date to pick the year of abbreviated dates', () => {
    expect(parseSheetDate(1211, new Date(2024, 11, 31)).date).toBe('2024-11-12');
    expect(parseSheetDate('12/11/2023', new Date(2024, 11, 31)).date).toBe('2023-11-12');
  });

  it('flags ambiguous 3-digit values with both readings', () => {
    expect(parseSheetDate(111, today)).toEqual({ date: '2025-11-01', status: 'ambiguous', alternative: '2025-01-11' });
  });

  it.each<Cell>([1, 2, 12, 'x', 3213, 9999, ''])('cannot interpret %j', (input) => {
    expect(parseSheetDate(input, today).status).toBe('missing');
  });
});

describe('cell parsing', () => {
  it.each<[Cell, object]>([
    [40, { weight: 40 }],
    ['40kg', { weight: 40 }],
    ['40 KG', { weight: 40 }],
    ['27.5', { weight: 27.5 }],
    ['27,5', { weight: 27.5 }],
    ['80x6', { weight: 80, reps: 6 }],
    ['80 x 6', { weight: 80, reps: 6 }],
    ['22,5kg×10', { weight: 22.5, reps: 10 }],
    ['-10', { weight: -10 }],
    ['prensa grande', { note: 'prensa grande' }],
  ])('weight %j', (input, expected) => {
    expect(parseWeightCell(input)).toEqual(expected);
  });

  it.each<[Cell, object]>([
    [8, { reps: 8 }],
    ['10', { reps: 10 }],
    ['8 reps', { reps: 8 }],
    ['fallo', { note: 'fallo' }],
  ])('reps %j', (input, expected) => {
    expect(parseRepsCell(input)).toEqual(expected);
  });
});

describe('parseGymSheet', () => {
  // A small sheet mimicking GYM.xlsx: names on B/D/F, "Peso | Reps" below, sets underneath.
  const rows: Cell[][] = [
    ['PIERNAS A'],
    [null, 'Squat machine', null, 'Peso muerto', null, 'Curl femoral'],
    [null, 'Peso', 'Reps', 'Peso', 'Reps', 'Peso', 'Reps'],
    [1211, 40, 10, '25', 5, '80x6'],
    [null, '42,5kg', 8, 27.5, '5', 30, 12],
    [null, 45, 8, null, null, 'banco roto', null],
    [],
    [1111, 40, 10, null, null, 30, 10],
    [7, 40, 9],
    [null, null, null, null, null, null, null],
    [null, 'Prensa', null, 'Sit calf raise'],
    [null, 'Peso', 'Reps', 'Peso', 'Reps'],
    [null, 80, 12, 30, 15],
    [111, 90, 10],
  ];

  const { groups, warnings } = parseGymSheet('Piernas A', rows, today);

  it('splits sessions by column A and keeps exercises per block', () => {
    expect(warnings).toEqual([]);
    expect(groups.map((g) => [g.dateRaw, g.date, g.dateStatus])).toEqual([
      ['1211', '2025-11-12', 'ok'],
      ['1111', '2025-11-11', 'ok'],
      ['7', undefined, 'missing'],
      ['', undefined, 'missing'],
      ['111', '2025-11-01', 'ambiguous'],
    ]);
  });

  it('parses sets, compound cells and notes', () => {
    const [first] = groups;
    expect(first.firstRow).toBe(4);
    expect(first.lastRow).toBe(6);
    const byName = Object.fromEntries(first.exercises.map((e) => [e.name, e]));
    expect(byName['Squat machine'].sets).toEqual([
      { weight: 40, reps: 10 },
      { weight: 42.5, reps: 8 },
      { weight: 45, reps: 8 },
    ]);
    expect(byName['Peso muerto'].sets).toEqual([
      { weight: 25, reps: 5 },
      { weight: 27.5, reps: 5 },
    ]);
    expect(byName['Curl femoral'].sets).toEqual([
      { weight: 80, reps: 6 },
      { weight: 30, reps: 12 },
    ]);
    expect(byName['Curl femoral'].notes).toEqual(['banco roto']);
  });

  it('drops exercises without data and handles a second header block', () => {
    expect(groups[1].exercises.map((e) => e.name)).toEqual(['Squat machine', 'Curl femoral']);
    expect(groups[3].exercises.map((e) => [e.name, e.sets.length])).toEqual([
      ['Prensa', 1],
      ['Sit calf raise', 1],
    ]);
  });

  it('does not mistake an exercise called "Peso muerto" for the sub-header', () => {
    const tricky: Cell[][] = [
      [null, 'Peso muerto', null],
      [null, 'Peso', 'Reps'],
      [1211, 60, 5],
    ];
    const r = parseGymSheet('X', tricky, today);
    expect(r.groups[0].exercises[0]).toMatchObject({ name: 'Peso muerto', sets: [{ weight: 60, reps: 5 }] });
  });

  it('warns when a sheet has no recognizable blocks', () => {
    expect(parseGymSheet('Notas', [['hola'], ['chau']], today).warnings[0]).toMatch(/Notas/);
  });
});
