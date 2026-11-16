/**
 * Parser for the original GYM.xlsx layout, working on plain 2D arrays of cell values
 * (as produced by SheetJS `sheet_to_json(ws, { header: 1, raw: true })`) so it is testable without Excel files.
 *
 * Layout:
 *   - A header row holds exercise names every two columns (B, D, F, …).
 *   - The next row says "Peso | Reps" under each exercise.
 *   - Rows below are sets. Column A sometimes holds an abbreviated date (1211 = 12/11) or a number.
 *     A non-empty column A starts a new group; empty A continues the group above.
 *   - Cells may contain text such as "40kg", "27.5" or "80x6" (weight × reps).
 */

export type Cell = string | number | boolean | Date | null | undefined;

export interface ParsedSet {
  weight: number;
  reps: number;
  /** Text that could not be interpreted, kept as a note. */
  note?: string;
}

export interface ParsedExercise {
  name: string;
  sets: ParsedSet[];
  notes: string[];
}

export type DateStatus = 'ok' | 'ambiguous' | 'missing';

export interface ParsedGroup {
  id: string;
  sheet: string;
  /** Spreadsheet row numbers (1-based) covered by this group. */
  firstRow: number;
  lastRow: number;
  /** Raw content of column A. */
  dateRaw: string;
  /** YYYY-MM-DD when it could be interpreted. */
  date?: string;
  dateStatus: DateStatus;
  exercises: ParsedExercise[];
}

export interface ParseResult {
  groups: ParsedGroup[];
  warnings: string[];
}

const text = (c: Cell) => (c === null || c === undefined ? '' : c instanceof Date ? c.toISOString() : String(c).trim());
const isBlank = (c: Cell) => text(c) === '';
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function validDay(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
}

/** The most recent year in which day/month is not after `today`. */
function inferYear(m: number, d: number, today: Date) {
  const y = today.getFullYear();
  const candidate = new Date(y, m - 1, d);
  return candidate.getTime() > today.getTime() ? y - 1 : y;
}

/**
 * Interprets column A. "1211" → 12/11, "511" → 5/11, "12/11", "12/11/2025", Excel date serials and Date
 * objects. Three-digit values that fit both D/MM and DD/M (e.g. 111) are ambiguous; small numbers are missing.
 */
export function parseSheetDate(c: Cell, today: Date = new Date()): { date?: string; status: DateStatus; alternative?: string } {
  if (c instanceof Date && !Number.isNaN(c.getTime())) {
    return { date: iso(c.getFullYear(), c.getMonth() + 1, c.getDate()), status: 'ok' };
  }
  const s = text(c);
  if (!s) return { status: 'missing' };

  // ISO dates (e.g. a Date cell re-read from its text form).
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [y, m, d] = [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])];
    return validDay(y, m, d) ? { date: iso(y, m, d), status: 'ok' } : { status: 'missing' };
  }

  // Real Excel dates (serial days since 1899-12-30), roughly years 1995–2100.
  const serial = typeof c === 'number' ? c : /^\d{5}(\.\d+)?$/.test(s) ? Number(s) : NaN;
  if (serial > 35000 && serial < 75000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
    return { date: iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), status: 'ok' };
  }

  const slash = s.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/);
  if (slash) {
    const d = Number(slash[1]);
    const m = Number(slash[2]);
    let y = slash[3] ? Number(slash[3]) : inferYear(m, d, today);
    if (y < 100) y += 2000;
    return validDay(y, m, d) ? { date: iso(y, m, d), status: 'ok' } : { status: 'missing' };
  }

  if (/^\d{3,4}$/.test(s)) {
    const options: { d: number; m: number }[] = [];
    if (s.length === 4) options.push({ d: Number(s.slice(0, 2)), m: Number(s.slice(2)) });
    else options.push({ d: Number(s.slice(0, 1)), m: Number(s.slice(1)) }, { d: Number(s.slice(0, 2)), m: Number(s.slice(2)) });
    const valid = options
      .filter(({ d, m }) => validDay(2024, m, d)) // leap year so 29/02 is accepted
      .map(({ d, m }) => iso(inferYear(m, d, today), m, d));
    if (valid.length === 1) return { date: valid[0], status: 'ok' };
    if (valid.length > 1) return { date: valid[0], status: 'ambiguous', alternative: valid[1] };
  }
  return { status: 'missing' };
}

const NUM = String.raw`[-+]?\d+(?:[.,]\d+)?`;
const toNum = (s: string) => Number(s.replace(',', '.'));

/** Parses a weight cell: 40, "40kg", "27.5", "27,5", "80x6" (weight × reps). */
export function parseWeightCell(c: Cell): { weight?: number; reps?: number; note?: string } {
  if (typeof c === 'number') return Number.isFinite(c) ? { weight: c } : {};
  const s = text(c);
  if (!s) return {};
  const compact = s.toLowerCase().replace(/\s+/g, '');
  let m = compact.match(new RegExp(`^(${NUM})(?:kgs?|lbs?)?$`));
  if (m) return { weight: toNum(m[1]) };
  m = compact.match(new RegExp(`^(${NUM})(?:kgs?|lbs?)?[x×*](\\d+)(?:reps?)?$`));
  if (m) return { weight: toNum(m[1]), reps: Number(m[2]) };
  return { note: s };
}

/** Parses a reps cell: 8, "8", "8 reps". */
export function parseRepsCell(c: Cell): { reps?: number; note?: string } {
  if (typeof c === 'number') return Number.isFinite(c) ? { reps: Math.round(c) } : {};
  const s = text(c);
  if (!s) return {};
  const m = s.toLowerCase().replace(/\s+/g, '').match(/^(\d+)(?:reps?)?$/);
  if (m) return { reps: Number(m[1]) };
  const w = parseWeightCell(c);
  if (w.reps !== undefined) return { reps: w.reps };
  return { note: s };
}

// Sub-header labels: "Peso", "Peso (kg)", "Reps", "Rep." — but not exercise names such as "Peso muerto".
const isPeso = (c: Cell) => /^peso\s*(\(.*\))?$/i.test(text(c));
const isReps = (c: Cell) => /^(reps?|repeticiones)\.?$/i.test(text(c));

interface Block {
  name: string;
  weightCol: number;
}

/** Finds "Peso | Reps" sub-header rows and the exercise names in the row above. */
function headerBlocks(rows: Cell[][], r: number): Block[] | null {
  const sub = rows[r + 1];
  const head = rows[r];
  if (!sub || !head) return null;
  const blocks: Block[] = [];
  for (let c = 0; c < sub.length; c++) {
    if (isPeso(sub[c]) && isReps(sub[c + 1])) {
      // Names are usually above "Peso"; merged cells sometimes leave them above "Reps".
      const name = text(head[c]) || text(head[c + 1]);
      if (name) blocks.push({ name, weightCol: c });
    }
  }
  return blocks.length > 0 ? blocks : null;
}

export function parseGymSheet(sheet: string, rows: Cell[][], today: Date = new Date()): ParseResult {
  const groups: ParsedGroup[] = [];
  const warnings: string[] = [];
  let blocks: Block[] | null = null;
  let current: ParsedGroup | null = null;

  const closeGroup = () => {
    if (current) {
      current.exercises = current.exercises.filter((e) => e.sets.length > 0 || e.notes.length > 0);
      if (current.exercises.length > 0) groups.push(current);
    }
    current = null;
  };

  for (let r = 0; r < rows.length; r++) {
    const found = headerBlocks(rows, r);
    if (found) {
      closeGroup();
      blocks = found;
      r++; // skip the "Peso | Reps" row
      continue;
    }
    if (!blocks) continue;
    const row = rows[r] ?? [];
    const hasData = blocks.some((b) => !isBlank(row[b.weightCol]) || !isBlank(row[b.weightCol + 1]));

    if (!isBlank(row[0])) {
      closeGroup();
      const parsed = parseSheetDate(row[0], today);
      current = {
        id: `${sheet}:${r + 1}`,
        sheet,
        firstRow: r + 1,
        lastRow: r + 1,
        dateRaw: text(row[0]),
        date: parsed.date,
        dateStatus: parsed.status,
        exercises: blocks.map((b) => ({ name: b.name, sets: [], notes: [] })),
      };
    } else if (!hasData) {
      continue;
    } else if (!current) {
      current = {
        id: `${sheet}:${r + 1}`,
        sheet,
        firstRow: r + 1,
        lastRow: r + 1,
        dateRaw: '',
        dateStatus: 'missing',
        exercises: blocks.map((b) => ({ name: b.name, sets: [], notes: [] })),
      };
    }
    if (!hasData || !current) continue;
    const group: ParsedGroup = current;
    group.lastRow = r + 1;

    blocks.forEach((b, i) => {
      const wc = row[b.weightCol];
      const rc = row[b.weightCol + 1];
      if (isBlank(wc) && isBlank(rc)) return;
      const w = parseWeightCell(wc);
      const rp = parseRepsCell(rc);
      const ex = group.exercises[i];
      const reps = rp.reps ?? w.reps;
      if (w.note) ex.notes.push(w.note);
      if (rp.note) ex.notes.push(rp.note);
      if (w.weight === undefined && reps === undefined) return;
      ex.sets.push({ weight: w.weight ?? 0, reps: reps ?? 0, note: reps === undefined ? 'Sin reps en la planilla' : undefined });
    });
  }
  closeGroup();

  if (!groups.length) warnings.push(`La hoja "${sheet}" no tiene bloques con el formato "Peso | Reps".`);
  return { groups, warnings };
}
