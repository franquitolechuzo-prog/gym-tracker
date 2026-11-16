import { epley1RM } from './strength';
import { formatWeight } from './format';

export interface SetLike {
  weight: number;
  reps: number;
  isWarmup: boolean;
}

export type Comparison = 'better' | 'equal' | 'worse';

/** "Better" means more weight, or more reps with the same weight. */
export function compareToPrevious(current: Pick<SetLike, 'weight' | 'reps'>, previous?: Pick<SetLike, 'weight' | 'reps'>): Comparison | undefined {
  if (!previous || current.reps <= 0) return undefined;
  if (current.weight > previous.weight) return 'better';
  if (current.weight === previous.weight) {
    if (current.reps > previous.reps) return 'better';
    if (current.reps === previous.reps) return 'equal';
  }
  return 'worse';
}

/** Pairs each set with the previous session's set of the same kind (warm-up/working) and position. */
export function alignWithPrevious<T extends SetLike, P extends SetLike>(current: T[], previous: P[]): (P | undefined)[] {
  const prevWarmup = previous.filter((s) => s.isWarmup);
  const prevWorking = previous.filter((s) => !s.isWarmup);
  let w = 0;
  let k = 0;
  return current.map((s) => (s.isWarmup ? prevWarmup[w++] : prevWorking[k++]));
}

const weightKey = (w: number) => Math.round(w * 100) / 100;

export interface Records {
  maxWeight?: number;
  best1RM?: number;
  /** Best reps achieved at each weight. */
  maxRepsByWeight: Map<number, number>;
}

/** Personal records from working sets with at least one rep. */
export function computeRecords(sets: SetLike[]): Records {
  const records: Records = { maxRepsByWeight: new Map() };
  for (const s of sets) {
    if (s.isWarmup || s.reps <= 0) continue;
    const key = weightKey(s.weight);
    records.maxWeight = Math.max(records.maxWeight ?? -Infinity, s.weight);
    records.best1RM = Math.max(records.best1RM ?? -Infinity, epley1RM(s.weight, s.reps));
    records.maxRepsByWeight.set(key, Math.max(records.maxRepsByWeight.get(key) ?? 0, s.reps));
  }
  return records;
}

export type PRKind = 'weight' | 'reps' | '1rm';

/**
 * Which records a set beats. Returns nothing when there is no history yet
 * (the first session would otherwise be all records).
 */
export function detectPRs(set: SetLike, records: Records): PRKind[] {
  if (set.isWarmup || set.reps <= 0 || records.maxWeight === undefined) return [];
  const out: PRKind[] = [];
  if (set.weight > records.maxWeight) out.push('weight');
  const prevReps = records.maxRepsByWeight.get(weightKey(set.weight));
  if (prevReps !== undefined && set.reps > prevReps) out.push('reps');
  if (records.best1RM !== undefined && epley1RM(set.weight, set.reps) > records.best1RM + 1e-9) out.push('1rm');
  return out;
}

/** Folds a just-completed set into the records (used to evaluate later sets in the same session). */
export function mergeRecords(records: Records, sets: SetLike[]): Records {
  const extra = computeRecords(sets);
  const merged: Records = { maxRepsByWeight: new Map(records.maxRepsByWeight) };
  const max = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.max(a, b));
  merged.maxWeight = max(records.maxWeight, extra.maxWeight);
  merged.best1RM = max(records.best1RM, extra.best1RM);
  for (const [w, r] of extra.maxRepsByWeight) merged.maxRepsByWeight.set(w, Math.max(merged.maxRepsByWeight.get(w) ?? 0, r));
  return merged;
}

/** "25 kg × 5", "PC × 8", "PC +10 kg × 6", "PC −15 kg × 5". */
export function formatSet(weight: number, reps: number, unit: string, isBodyweight = false): string {
  if (!isBodyweight) return `${formatWeight(weight)} ${unit} × ${reps}`;
  if (weight === 0) return `PC × ${reps}`;
  return `PC ${weight > 0 ? '+' : '−'}${formatWeight(Math.abs(weight))} ${unit} × ${reps}`;
}

/** Sets to pre-fill for an exercise: last time's sets, topped up to the routine's target. */
export function planSets(
  previous: SetLike[] | undefined,
  target?: { targetSets: number; targetRepsMin?: number },
  fallbackCount = 3,
): SetLike[] {
  if (previous && previous.length > 0) {
    const sets = previous.map(({ weight, reps, isWarmup }) => ({ weight, reps, isWarmup }));
    const working = sets.filter((s) => !s.isWarmup);
    const template = working.at(-1) ?? sets.at(-1)!;
    for (let i = working.length; i < (target?.targetSets ?? 0); i++) sets.push({ ...template, isWarmup: false });
    return sets;
  }
  const count = target?.targetSets ?? fallbackCount;
  return Array.from({ length: count }, () => ({ weight: 0, reps: target?.targetRepsMin ?? 0, isWarmup: false }));
}
