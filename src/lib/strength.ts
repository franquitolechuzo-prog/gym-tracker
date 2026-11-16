/**
 * Estimated one-rep max using Epley: weight × (1 + reps / 30).
 * A single rep is the 1RM itself; zero reps yields 0.
 */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Total volume (Σ weight × reps), excluding warm-up sets. */
export function totalVolume(sets: { weight: number; reps: number; isWarmup: boolean }[]): number {
  return sets.reduce((sum, s) => (s.isWarmup ? sum : sum + s.weight * s.reps), 0);
}
