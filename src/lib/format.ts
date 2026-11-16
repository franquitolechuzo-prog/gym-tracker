/**
 * Parses a user-typed number accepting either comma or dot as decimal separator
 * ("12,5", "27.5", " -5 "). Returns null for empty or invalid input.
 */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const s = input.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const weightFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

/** Formats a weight in es-AR style: 12.5 -> "12,5". */
export function formatWeight(n: number): string {
  return weightFormatter.format(n);
}

/** Lowercases and strips diacritics so "Cuádriceps" matches "cuadriceps". */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** True if every whitespace-separated term of `query` appears in `text` (accent/case-insensitive). */
export function matchesSearch(text: string, query: string): boolean {
  const haystack = normalizeText(text);
  return normalizeText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/** Local calendar date as 'YYYY-MM-DD'. */
export function toLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
