import { db, type GymDB } from './db';
import type { RoutineExercise, Session, SessionExercise, SetEntry } from './types';
import { newId } from '../lib/id';
import { toLocalDateString } from '../lib/format';
import { planSets } from '../lib/progress';
import { listRoutineExercises } from './routines';

/** Sets without an explicit `done` flag (e.g. imported or edited history) count as logged. */
export const isLogged = (s: SetEntry) => s.done !== false;

export async function getActiveSession(database: GymDB = db): Promise<Session | undefined> {
  return database.sessions
    .orderBy('startedAt')
    .reverse()
    .filter((s) => !s.finishedAt)
    .first();
}

export async function listSessionExercises(sessionId: string, database: GymDB = db): Promise<SessionExercise[]> {
  return database.sessionExercises.where('[sessionId+order]').between([sessionId, -Infinity], [sessionId, Infinity]).toArray();
}

export async function listSets(sessionExerciseId: string, database: GymDB = db): Promise<SetEntry[]> {
  return (await database.sets.where('sessionExerciseId').equals(sessionExerciseId).toArray()).sort((a, b) => a.setNumber - b.setNumber);
}

export interface HistoryEntry {
  session: Session;
  sessionExercise: SessionExercise;
  sets: SetEntry[];
}

/**
 * Finished sessions containing an exercise, newest first, with their logged sets.
 * `before` excludes sessions started at/after that time; `excludeSessionId` skips one session.
 */
export async function getExerciseHistory(
  exerciseId: string,
  opts: { excludeSessionId?: string; before?: number } = {},
  database: GymDB = db,
): Promise<HistoryEntry[]> {
  const ses = await database.sessionExercises.where('exerciseId').equals(exerciseId).toArray();
  const sessions = await database.sessions.bulkGet([...new Set(ses.map((s) => s.sessionId))]);
  const valid = new Map<string, Session>();
  for (const s of sessions) {
    if (!s || !s.finishedAt || s.id === opts.excludeSessionId) continue;
    if (opts.before !== undefined && s.startedAt >= opts.before) continue;
    valid.set(s.id, s);
  }
  const entries = await Promise.all(
    ses
      .filter((se) => valid.has(se.sessionId))
      .map(async (se) => ({
        session: valid.get(se.sessionId)!,
        sessionExercise: se,
        sets: (await listSets(se.id, database)).filter(isLogged),
      })),
  );
  return entries
    .filter((e) => e.sets.length > 0)
    .sort(
      (a, b) =>
        b.session.date.localeCompare(a.session.date) ||
        b.session.startedAt - a.session.startedAt ||
        b.sessionExercise.order - a.sessionExercise.order,
    );
}

/** The routine's target for an exercise (first occurrence), if the routine includes it. */
export async function findRoutineTarget(routineId: string, exerciseId: string, database: GymDB = db): Promise<RoutineExercise | undefined> {
  return database.routineExercises.where('routineId').equals(routineId).filter((r) => r.exerciseId === exerciseId).first();
}

/** Logged sets from the most recent earlier session of this exercise. */
export async function getPreviousSets(exerciseId: string, current?: Session, database: GymDB = db): Promise<SetEntry[] | undefined> {
  const history = await getExerciseHistory(exerciseId, { excludeSessionId: current?.id, before: current?.startedAt }, database);
  return history[0]?.sets;
}

async function addPrefilledExercise(
  database: GymDB,
  session: Session,
  exerciseId: string,
  order: number,
  target?: Pick<RoutineExercise, 'targetSets' | 'targetRepsMin'>,
): Promise<SessionExercise> {
  const se: SessionExercise = { id: newId(), sessionId: session.id, exerciseId, order };
  const previous = await getPreviousSets(exerciseId, session, database);
  const planned = planSets(previous, target);
  await database.sessionExercises.add(se);
  await database.sets.bulkAdd(
    planned.map((p, i) => ({ id: newId(), sessionExerciseId: se.id, setNumber: i + 1, ...p, done: false })),
  );
  return se;
}

const SESSION_TABLES = (d: GymDB) => [d.sessions, d.sessionExercises, d.sets, d.routineExercises, d.routines];

/** Starts a session (from a routine or empty), pre-filling each exercise with last time's sets. */
export async function startSession(routineId?: string, database: GymDB = db, now = Date.now()): Promise<Session> {
  return database.transaction('rw', SESSION_TABLES(database), async () => {
    const session: Session = { id: newId(), routineId, date: toLocalDateString(new Date(now)), startedAt: now };
    await database.sessions.add(session);
    if (routineId) {
      const items = await listRoutineExercises(routineId, database);
      for (const [order, item] of items.entries()) {
        await addPrefilledExercise(database, session, item.exerciseId, order, item);
      }
    }
    return session;
  });
}

export async function addExerciseToSession(sessionId: string, exerciseId: string, database: GymDB = db): Promise<SessionExercise> {
  return database.transaction('rw', SESSION_TABLES(database), async () => {
    const session = await database.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const items = await listSessionExercises(sessionId, database);
    const target = session.routineId
      ? await findRoutineTarget(session.routineId, exerciseId, database)
      : undefined;
    return addPrefilledExercise(database, session, exerciseId, (items.at(-1)?.order ?? -1) + 1, target);
  });
}

/** Swaps the exercise, re-planning its sets from the new exercise's history. */
export async function replaceSessionExercise(sessionExerciseId: string, exerciseId: string, database: GymDB = db): Promise<void> {
  await database.transaction('rw', SESSION_TABLES(database), async () => {
    const se = await database.sessionExercises.get(sessionExerciseId);
    if (!se) return;
    const session = (await database.sessions.get(se.sessionId))!;
    await database.sets.where('sessionExerciseId').equals(se.id).delete();
    const target = session.routineId
      ? await findRoutineTarget(session.routineId, exerciseId, database)
      : undefined;
    const previous = await getPreviousSets(exerciseId, session, database);
    await database.sessionExercises.update(se.id, { exerciseId });
    await database.sets.bulkAdd(
      planSets(previous, target).map((p, i) => ({ id: newId(), sessionExerciseId: se.id, setNumber: i + 1, ...p, done: false })),
    );
  });
}

export async function removeSessionExercise(sessionExerciseId: string, database: GymDB = db): Promise<void> {
  await database.transaction('rw', [database.sessionExercises, database.sets], async () => {
    const se = await database.sessionExercises.get(sessionExerciseId);
    if (!se) return;
    await database.sets.where('sessionExerciseId').equals(se.id).delete();
    await database.sessionExercises.delete(se.id);
    const rest = await listSessionExercises(se.sessionId, database);
    await Promise.all(rest.map((r, order) => database.sessionExercises.update(r.id, { order })));
  });
}

export async function moveSessionExercise(sessionExerciseId: string, dir: -1 | 1, database: GymDB = db): Promise<void> {
  await database.transaction('rw', database.sessionExercises, async () => {
    const se = await database.sessionExercises.get(sessionExerciseId);
    if (!se) return;
    const items = await listSessionExercises(se.sessionId, database);
    const i = items.findIndex((x) => x.id === se.id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    await Promise.all(items.map((r, order) => database.sessionExercises.update(r.id, { order })));
  });
}

/** Adds a set copying the last one (not done). */
export async function addSet(sessionExerciseId: string, database: GymDB = db): Promise<SetEntry> {
  return database.transaction('rw', database.sets, async () => {
    const sets = await listSets(sessionExerciseId, database);
    const last = sets.at(-1);
    const set: SetEntry = {
      id: newId(),
      sessionExerciseId,
      setNumber: sets.length + 1,
      weight: last?.weight ?? 0,
      reps: last?.reps ?? 0,
      isWarmup: false,
      done: false,
    };
    await database.sets.add(set);
    return set;
  });
}

export async function removeSet(setId: string, database: GymDB = db): Promise<void> {
  await database.transaction('rw', database.sets, async () => {
    const set = await database.sets.get(setId);
    if (!set) return;
    await database.sets.delete(setId);
    const rest = await listSets(set.sessionExerciseId, database);
    await Promise.all(rest.map((s, i) => database.sets.update(s.id, { setNumber: i + 1 })));
  });
}

export async function updateSet(
  setId: string,
  patch: Partial<Pick<SetEntry, 'weight' | 'reps' | 'isWarmup' | 'done' | 'rpe' | 'notes'>>,
  database: GymDB = db,
): Promise<void> {
  await database.sets.update(setId, patch);
}

export async function updateSessionExerciseNotes(id: string, notes: string, database: GymDB = db) {
  await database.sessionExercises.update(id, { notes: notes.trim() || undefined });
}

export async function updateSession(id: string, patch: Partial<Pick<Session, 'notes' | 'date'>>, database: GymDB = db) {
  const data = { ...patch };
  if (data.notes !== undefined) data.notes = data.notes.trim() || undefined;
  await database.sessions.update(id, data);
}

/** Counts for the "finish" confirmation. */
export async function getSessionCounts(sessionId: string, database: GymDB = db) {
  const ses = await listSessionExercises(sessionId, database);
  const sets = (await Promise.all(ses.map((se) => listSets(se.id, database)))).flat();
  return { done: sets.filter((s) => s.done).length, pending: sets.filter((s) => !s.done).length };
}

/**
 * Finishes a session: unchecked sets are discarded, exercises left empty are removed,
 * and a session with nothing logged is deleted altogether.
 */
export async function finishSession(sessionId: string, database: GymDB = db, now = Date.now()): Promise<'saved' | 'discarded'> {
  return database.transaction('rw', [database.sessions, database.sessionExercises, database.sets], async () => {
    const ses = await listSessionExercises(sessionId, database);
    let kept = 0;
    for (const se of ses) {
      const sets = await listSets(se.id, database);
      const done = sets.filter((s) => s.done);
      await database.sets.bulkDelete(sets.filter((s) => !s.done).map((s) => s.id));
      if (done.length === 0) {
        await database.sessionExercises.delete(se.id);
      } else {
        await Promise.all(done.map((s, i) => database.sets.update(s.id, { setNumber: i + 1 })));
        await database.sessionExercises.update(se.id, { order: kept++ });
      }
    }
    if (kept === 0) {
      await database.sessions.delete(sessionId);
      return 'discarded' as const;
    }
    await database.sessions.update(sessionId, { finishedAt: now });
    return 'saved' as const;
  });
}

/** Deletes a session and everything in it. */
export async function deleteSession(sessionId: string, database: GymDB = db): Promise<void> {
  await database.transaction('rw', [database.sessions, database.sessionExercises, database.sets], async () => {
    const ses = await database.sessionExercises.where('sessionId').equals(sessionId).toArray();
    await database.sets.where('sessionExerciseId').anyOf(ses.map((s) => s.id)).delete();
    await database.sessionExercises.bulkDelete(ses.map((s) => s.id));
    await database.sessions.delete(sessionId);
  });
}

/** Most recent finished session per routine (for the start screen). */
export async function lastSessionByRoutine(database: GymDB = db): Promise<Map<string, Session>> {
  const out = new Map<string, Session>();
  const sessions = await database.sessions.orderBy('startedAt').reverse().toArray();
  for (const s of sessions) if (s.routineId && s.finishedAt && !out.has(s.routineId)) out.set(s.routineId, s);
  return out;
}
