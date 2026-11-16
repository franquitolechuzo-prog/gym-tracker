import { Dexie, type EntityTable } from 'dexie';
import type {
  Exercise,
  KeyValue,
  Routine,
  RoutineExercise,
  Session,
  SessionExercise,
  SetEntry,
} from './types';

export class GymDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routineExercises!: EntityTable<RoutineExercise, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sessionExercises!: EntityTable<SessionExercise, 'id'>;
  sets!: EntityTable<SetEntry, 'id'>;
  kv!: EntityTable<KeyValue, 'key'>;

  constructor(name = 'gym-tracker') {
    super(name);
    // Note: booleans are not indexable in IndexedDB, so `archived`/`isWarmup` are filtered in memory.
    this.version(1).stores({
      exercises: 'id, name, muscleGroup',
      routines: 'id, order',
      routineExercises: 'id, routineId, exerciseId, [routineId+order]',
      sessions: 'id, date, startedAt, routineId, finishedAt',
      sessionExercises: 'id, sessionId, exerciseId, [sessionId+order]',
      sets: 'id, sessionExerciseId',
      kv: 'key',
    });
  }
}

export const db = new GymDB();
