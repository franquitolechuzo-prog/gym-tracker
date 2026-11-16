import { db, type GymDB } from '../db/db';
import type { Exercise, MuscleGroup, Session, SessionExercise, SetEntry } from '../db/types';
import { newId } from '../lib/id';
import { normalizeText } from '../lib/format';
import type { ParsedGroup } from './gymSheet';

/** For each spreadsheet exercise name: an existing exercise id, or a new exercise to create. */
export type ExerciseChoice = { kind: 'existing'; exerciseId: string } | { kind: 'new'; muscleGroup: MuscleGroup };

/** Suggests a mapping by accent/case-insensitive name match (active exercises first). */
export function suggestMapping(names: string[], exercises: Exercise[]): Map<string, ExerciseChoice> {
  const byName = new Map<string, Exercise>();
  for (const e of [...exercises].sort((a, b) => Number(b.archived) - Number(a.archived))) byName.set(normalizeText(e.name), e);
  const out = new Map<string, ExerciseChoice>();
  for (const name of names) {
    const match = byName.get(normalizeText(name));
    out.set(name, match ? { kind: 'existing', exerciseId: match.id } : { kind: 'new', muscleGroup: 'Otro' });
  }
  return out;
}

export function uniqueExerciseNames(groups: ParsedGroup[]): string[] {
  const seen = new Map<string, string>();
  for (const g of groups) for (const e of g.exercises) if (!seen.has(normalizeText(e.name))) seen.set(normalizeText(e.name), e.name);
  return [...seen.values()];
}

export interface ImportOptions {
  /** Skip dates that already have a finished session (avoids duplicates when importing twice). */
  skipExistingDates: boolean;
}

export interface ImportResult {
  sessions: number;
  sets: number;
  exercisesCreated: number;
  skippedDates: string[];
}

/**
 * Saves reviewed groups. Groups sharing a date become one session; the same exercise within a session is merged.
 * Every group must have a date by now.
 */
export async function importGroups(
  groups: ParsedGroup[],
  mapping: Map<string, ExerciseChoice>,
  options: ImportOptions,
  database: GymDB = db,
): Promise<ImportResult> {
  const undated = groups.filter((g) => !g.date);
  if (undated.length) throw new Error(`${undated.length} grupos no tienen fecha.`);

  return database.transaction(
    'rw',
    [database.exercises, database.routines, database.sessions, database.sessionExercises, database.sets],
    async () => {
      const [existingSessions, routines, exercises] = await Promise.all([
        database.sessions.filter((s) => !!s.finishedAt).toArray(),
        database.routines.toArray(),
        database.exercises.toArray(),
      ]);
      const existingDates = new Set(existingSessions.map((s) => s.date));
      const routineByName = new Map(routines.map((r) => [normalizeText(r.name), r.id]));

      // Resolve exercise names → ids, creating new exercises as needed (once per name).
      const idByName = new Map<string, string>();
      let exercisesCreated = 0;
      const resolve = async (name: string): Promise<string> => {
        const key = normalizeText(name);
        const cached = idByName.get(key);
        if (cached) return cached;
        const choice = mapping.get(name) ?? [...mapping].find(([n]) => normalizeText(n) === key)?.[1];
        let id: string;
        if (choice?.kind === 'existing') {
          id = choice.exerciseId;
        } else {
          const clash = exercises.find((e) => !e.archived && normalizeText(e.name) === key);
          if (clash) id = clash.id;
          else {
            id = newId();
            await database.exercises.add({
              id,
              name: name.trim(),
              muscleGroup: choice?.kind === 'new' ? choice.muscleGroup : 'Otro',
              unit: 'kg',
              isBodyweight: false,
              archived: false,
              createdAt: Date.now(),
            });
            exercisesCreated++;
          }
        }
        idByName.set(key, id);
        return id;
      };

      const byDate = new Map<string, ParsedGroup[]>();
      for (const g of groups) byDate.set(g.date!, [...(byDate.get(g.date!) ?? []), g]);

      const skippedDates: string[] = [];
      let sessionCount = 0;
      let setCount = 0;
      for (const [date, dateGroups] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
        if (options.skipExistingDates && existingDates.has(date)) {
          skippedDates.push(date);
          continue;
        }
        const [y, m, d] = date.split('-').map(Number);
        const startedAt = new Date(y, m - 1, d, 12, 0).getTime();
        const sheets = new Set(dateGroups.map((g) => normalizeText(g.sheet)));
        const routineId = sheets.size === 1 ? routineByName.get([...sheets][0]) : undefined;
        const session: Session = { id: newId(), routineId, date, startedAt, finishedAt: startedAt, notes: 'Importado de la planilla' };

        // Merge the same exercise across groups of this date, keeping first-seen order.
        const merged = new Map<string, { sets: ParsedGroup['exercises'][number]['sets']; notes: string[] }>();
        for (const g of dateGroups) {
          for (const e of g.exercises) {
            const exerciseId = await resolve(e.name);
            const entry = merged.get(exerciseId) ?? { sets: [], notes: [] };
            entry.sets.push(...e.sets);
            entry.notes.push(...e.notes);
            merged.set(exerciseId, entry);
          }
        }
        if (merged.size === 0) continue;

        await database.sessions.add(session);
        sessionCount++;
        let order = 0;
        for (const [exerciseId, { sets, notes }] of merged) {
          const se: SessionExercise = { id: newId(), sessionId: session.id, exerciseId, order: order++, notes: notes.join('; ') || undefined };
          await database.sessionExercises.add(se);
          const rows: SetEntry[] = sets.map((s, i) => ({
            id: newId(),
            sessionExerciseId: se.id,
            setNumber: i + 1,
            weight: s.weight,
            reps: s.reps,
            isWarmup: false,
            done: true,
            notes: s.note,
          }));
          await database.sets.bulkAdd(rows);
          setCount += rows.length;
        }
      }
      return { sessions: sessionCount, sets: setCount, exercisesCreated, skippedDates };
    },
  );
}
