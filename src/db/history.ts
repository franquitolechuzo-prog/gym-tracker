import { db, type GymDB } from './db';
import type { Exercise, Session } from './types';
import { isLogged } from './sessions';
import { totalVolume } from '../lib/strength';

export interface SessionSummary {
  session: Session;
  title: string;
  exerciseNames: string[];
  setCount: number;
  volume: number;
  durationMinutes?: number;
}

/** Finished sessions, newest first, with light aggregates for the history list. */
export async function listSessionSummaries(database: GymDB = db): Promise<SessionSummary[]> {
  const [sessions, routines, exercises, sessionExercises, sets] = await Promise.all([
    database.sessions.filter((s) => !!s.finishedAt).toArray(),
    database.routines.toArray(),
    database.exercises.toArray(),
    database.sessionExercises.toArray(),
    database.sets.toArray(),
  ]);
  const routineName = new Map(routines.map((r) => [r.id, r.name]));
  const exerciseName = new Map(exercises.map((e) => [e.id, e.name]));
  const setsBySe = groupBy(sets.filter(isLogged), (s) => s.sessionExerciseId);
  const seBySession = groupBy(sessionExercises, (se) => se.sessionId);

  return sessions
    .map((session) => {
      const ses = (seBySession.get(session.id) ?? []).sort((a, b) => a.order - b.order);
      const allSets = ses.flatMap((se) => setsBySe.get(se.id) ?? []);
      const duration = session.finishedAt ? (session.finishedAt - session.startedAt) / 60_000 : undefined;
      return {
        session,
        title: session.routineId ? (routineName.get(session.routineId) ?? 'Rutina eliminada') : 'Sesión libre',
        exerciseNames: ses.map((se) => exerciseName.get(se.exerciseId) ?? '?'),
        setCount: allSets.filter((s) => !s.isWarmup).length,
        volume: totalVolume(allSets),
        // Imported sessions have no real duration; hide implausible values.
        durationMinutes: duration !== undefined && duration > 0 && duration < 6 * 60 ? Math.round(duration) : undefined,
      };
    })
    .sort((a, b) => b.session.date.localeCompare(a.session.date) || b.session.startedAt - a.session.startedAt);
}

export interface ExerciseWithHistory {
  exercise: Exercise;
  sessionCount: number;
  lastDate: string;
}

/** Exercises that appear in at least one finished session, most recently trained first. */
export async function listExercisesWithHistory(database: GymDB = db): Promise<ExerciseWithHistory[]> {
  const [sessions, exercises, sessionExercises] = await Promise.all([
    database.sessions.filter((s) => !!s.finishedAt).toArray(),
    database.exercises.toArray(),
    database.sessionExercises.toArray(),
  ]);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const stats = new Map<string, { ids: Set<string>; lastDate: string }>();
  for (const se of sessionExercises) {
    const session = sessionById.get(se.sessionId);
    if (!session) continue;
    const st = stats.get(se.exerciseId) ?? { ids: new Set(), lastDate: '' };
    st.ids.add(session.id);
    if (session.date > st.lastDate) st.lastDate = session.date;
    stats.set(se.exerciseId, st);
  }
  return exercises
    .filter((e) => stats.has(e.id))
    .map((exercise) => ({ exercise, sessionCount: stats.get(exercise.id)!.ids.size, lastDate: stats.get(exercise.id)!.lastDate }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.exercise.name.localeCompare(b.exercise.name, 'es'));
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
