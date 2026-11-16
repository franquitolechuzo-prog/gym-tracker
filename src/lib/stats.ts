import { epley1RM, totalVolume } from './strength';
import type { SetLike } from './progress';

export interface DatedSets {
  date: string; // YYYY-MM-DD
  sets: SetLike[];
}

export interface SessionPoint {
  date: string;
  maxWeight: number;
  best1RM: number;
  volume: number;
}

/** One point per session (oldest first) using working sets only; sessions with only warm-ups are skipped. */
export function exerciseSeries(entries: DatedSets[]): SessionPoint[] {
  return entries
    .map(({ date, sets }) => {
      const working = sets.filter((s) => !s.isWarmup && s.reps > 0);
      if (working.length === 0) return null;
      return {
        date,
        maxWeight: Math.max(...working.map((s) => s.weight)),
        best1RM: Math.max(...working.map((s) => epley1RM(s.weight, s.reps))),
        volume: totalVolume(working),
      };
    })
    .filter((p): p is SessionPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface RecordDetail {
  weight: number;
  reps: number;
  date: string;
}

export interface RecordsDetail {
  maxWeight?: RecordDetail;
  best1RM?: RecordDetail & { value: number };
  /** Best reps per weight, heaviest first. */
  repsByWeight: RecordDetail[];
}

/** Personal records with the date each was first achieved. */
export function recordsDetail(entries: DatedSets[]): RecordsDetail {
  const out: RecordsDetail = { repsByWeight: [] };
  const byWeight = new Map<number, RecordDetail>();
  const chronological = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  for (const { date, sets } of chronological) {
    for (const s of sets) {
      if (s.isWarmup || s.reps <= 0) continue;
      const rec = { weight: s.weight, reps: s.reps, date };
      if (!out.maxWeight || s.weight > out.maxWeight.weight || (s.weight === out.maxWeight.weight && s.reps > out.maxWeight.reps)) {
        out.maxWeight = rec;
      }
      const value = epley1RM(s.weight, s.reps);
      if (!out.best1RM || value > out.best1RM.value + 1e-9) out.best1RM = { ...rec, value };
      const key = Math.round(s.weight * 100) / 100;
      const prev = byWeight.get(key);
      if (!prev || s.reps > prev.reps) byWeight.set(key, rec);
    }
  }
  out.repsByWeight = [...byWeight.values()].sort((a, b) => b.weight - a.weight);
  return out;
}

/**
 * Progressive overload: if every working set last time reached the top of the target rep range
 * (and at least the target number of sets was done), suggest adding one increment to the heaviest weight.
 */
export function suggestProgression(
  previous: SetLike[] | undefined,
  target: { targetSets: number; targetRepsMax?: number } | undefined,
  increment: number,
): { weight: number; reason: string } | undefined {
  if (!previous || !target?.targetRepsMax || increment <= 0) return undefined;
  const working = previous.filter((s) => !s.isWarmup);
  if (working.length === 0 || working.length < target.targetSets) return undefined;
  if (!working.every((s) => s.reps >= target.targetRepsMax!)) return undefined;
  const top = Math.max(...working.map((s) => s.weight));
  return {
    weight: Math.round((top + increment) * 100) / 100,
    reason: `La última vez hiciste ${working.length} series de ${target.targetRepsMax}+ reps`,
  };
}
