// Domain model. IDs are string UUIDs so JSON backups can be merged safely.
// Timestamps are epoch milliseconds; `Session.date` is a local 'YYYY-MM-DD' string.

export type WeightUnit = 'kg' | 'lb';

export const MUSCLE_GROUPS = [
  'Piernas',
  'Espalda',
  'Pecho',
  'Hombros',
  'Brazos',
  'Core',
  'Otro',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment?: string;
  unit: WeightUnit;
  /** Bodyweight exercises store *added* weight: 0 = bodyweight only, negative = assisted. */
  isBodyweight: boolean;
  notes?: string;
  /** Exercises used in history are archived instead of deleted. */
  archived: boolean;
  createdAt: number;
}

export interface Routine {
  id: string;
  name: string;
  notes?: string;
  order: number;
  createdAt: number;
}

export interface RoutineExercise {
  id: string;
  routineId: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  restSeconds?: number;
}

export interface Session {
  id: string;
  routineId?: string;
  date: string;
  startedAt: number;
  finishedAt?: number;
  notes?: string;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  notes?: string;
}

export interface SetEntry {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  isWarmup: boolean;
  /** Whether the set was ticked as done during the session. */
  done?: boolean;
  rpe?: number;
  notes?: string;
}

export interface Settings {
  unit: WeightUnit;
  weightIncrement: number;
  defaultRestSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  unit: 'kg',
  weightIncrement: 2.5,
  defaultRestSeconds: 120,
};

/** Generic key/value row used for settings and internal flags. */
export interface KeyValue {
  key: string;
  value: unknown;
}
