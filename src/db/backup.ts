import { db, type GymDB } from './db';
import type { Exercise, KeyValue, Routine, RoutineExercise, Session, SessionExercise, SetEntry } from './types';
import { ensureSeeded } from './seed';
import { isLogged } from './sessions';
import { epley1RM } from '../lib/strength';

export const BACKUP_FORMAT = 'gym-tracker-backup';
export const BACKUP_VERSION = 1;

export interface BackupData {
  exercises: Exercise[];
  routines: Routine[];
  routineExercises: RoutineExercise[];
  sessions: Session[];
  sessionExercises: SessionExercise[];
  sets: SetEntry[];
  kv: KeyValue[];
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: BackupData;
}

const TABLES = ['exercises', 'routines', 'routineExercises', 'sessions', 'sessionExercises', 'sets', 'kv'] as const;
// Transient UI state that should not travel between devices.
const SKIP_KV = new Set(['restTimer']);

const allTables = (d: GymDB) => TABLES.map((t) => d[t]);

export async function exportBackup(database: GymDB = db, now = new Date()): Promise<Backup> {
  const data = await database.transaction('r', allTables(database), async () => {
    const entries = await Promise.all(TABLES.map(async (t) => [t, await database[t].toArray()] as const));
    return Object.fromEntries(entries) as unknown as BackupData;
  });
  data.kv = data.kv.filter((r) => !SKIP_KV.has(r.key));
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export class BackupError extends Error {}

/** Validates the overall shape of a parsed backup file. */
export function parseBackup(json: unknown): Backup {
  const b = json as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) {
    throw new BackupError('El archivo no es un respaldo de esta app.');
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError('El respaldo es de una versión más nueva de la app. Actualizala e intentá de nuevo.');
  }
  const data = b.data as Partial<BackupData> | undefined;
  for (const t of TABLES) {
    if (!Array.isArray(data?.[t])) throw new BackupError(`El respaldo está incompleto (falta "${t}").`);
  }
  for (const t of TABLES) {
    const key = t === 'kv' ? 'key' : 'id';
    if (!(data![t] as unknown[]).every((row) => row && typeof (row as Record<string, unknown>)[key] === 'string')) {
      throw new BackupError(`El respaldo tiene datos inválidos en "${t}".`);
    }
  }
  return b as Backup;
}

export function summarizeBackup(b: Backup) {
  const finished = b.data.sessions.filter((s) => s.finishedAt);
  const dates = finished.map((s) => s.date).sort();
  return {
    exercises: b.data.exercises.length,
    routines: b.data.routines.length,
    sessions: finished.length,
    firstDate: dates[0],
    lastDate: dates.at(-1),
  };
}

/** Replaces everything in the database with the backup's contents. */
export async function restoreBackup(backup: Backup, database: GymDB = db): Promise<void> {
  await database.transaction('rw', allTables(database), async () => {
    await Promise.all(TABLES.map((t) => database[t].clear()));
    for (const t of TABLES) {
      await (database[t] as unknown as { bulkAdd(rows: unknown[]): Promise<unknown> }).bulkAdd(backup.data[t]);
    }
    // Never re-seed defaults on top of restored data.
    if (!(await database.kv.get('seeded'))) await database.kv.put({ key: 'seeded', value: Date.now() });
  });
}

/** Deletes all data and leaves the app as on first launch (default exercises and routines). */
export async function resetDatabase(database: GymDB = db): Promise<void> {
  await database.transaction('rw', allTables(database), async () => {
    await Promise.all(TABLES.map((t) => database[t].clear()));
  });
  await ensureSeeded(database);
}

const csvNumber = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, useGrouping: false });

function csvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  const s = typeof value === 'number' ? csvNumber.format(value) : value;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Logged sets of finished sessions as CSV, oldest first. Uses ";" and decimal commas so it opens
 * directly in Excel/Sheets configured for Spanish (Argentina); starts with a UTF-8 BOM for accents.
 */
export async function exportHistoryCsv(database: GymDB = db): Promise<string> {
  const [sessions, routines, exercises, sessionExercises, sets] = await Promise.all([
    database.sessions.filter((s) => !!s.finishedAt).toArray(),
    database.routines.toArray(),
    database.exercises.toArray(),
    database.sessionExercises.toArray(),
    database.sets.toArray(),
  ]);
  const routineName = new Map(routines.map((r) => [r.id, r.name]));
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const seById = new Map(sessionExercises.map((se) => [se.id, se]));

  const rows = sets
    .filter(isLogged)
    .map((set) => {
      const se = seById.get(set.sessionExerciseId);
      const session = se && sessionById.get(se.sessionId);
      return session && se ? { set, se, session } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort(
      (a, b) =>
        a.session.date.localeCompare(b.session.date) ||
        a.session.startedAt - b.session.startedAt ||
        a.se.order - b.se.order ||
        a.set.setNumber - b.set.setNumber,
    );

  const header = ['Fecha', 'Rutina', 'Ejercicio', 'Grupo muscular', 'Serie', 'Peso', 'Unidad', 'Reps', 'Calentamiento', '1RM estimado', 'Notas del ejercicio', 'Notas de la sesión'];
  const lines = [header.join(';')];
  for (const { set, se, session } of rows) {
    const ex = exerciseById.get(se.exerciseId);
    lines.push(
      [
        session.date,
        session.routineId ? (routineName.get(session.routineId) ?? '') : 'Sesión libre',
        ex?.name ?? '?',
        ex?.muscleGroup ?? '',
        set.setNumber,
        set.weight,
        ex?.unit ?? '',
        set.reps,
        set.isWarmup ? 'sí' : 'no',
        set.isWarmup || set.reps <= 0 ? undefined : Math.round(epley1RM(set.weight, set.reps) * 10) / 10,
        se.notes,
        session.notes,
      ]
        .map(csvCell)
        .join(';'),
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Triggers a browser download of a text file. */
export function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
