import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/Layout';
import { db } from '../db/db';
import { MUSCLE_GROUPS } from '../db/types';
import { matchesSearch } from '../lib/format';

export function ExercisesPage() {
  const [query, setQuery] = useState('');
  const exercises = useLiveQuery(() => db.exercises.filter((e) => !e.archived).toArray(), []);

  const visible = (exercises ?? [])
    .filter((e) => matchesSearch(e.name, query))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <>
      <PageHeader title="Ejercicios" />
      <div className="p-4">
        <label className="sr-only" htmlFor="exercise-search">
          Buscar ejercicio
        </label>
        <input
          id="exercise-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar…"
          className="h-12 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 text-base outline-none focus:border-accent"
        />
      </div>
      {MUSCLE_GROUPS.map((group) => {
        const items = visible.filter((e) => e.muscleGroup === group);
        if (items.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`group-${group}`}>
            <h2
              id={`group-${group}`}
              className="bg-neutral-900/60 px-4 py-2 text-sm font-semibold tracking-wide text-neutral-400 uppercase"
            >
              {group}
            </h2>
            <ul className="divide-y divide-neutral-900">
              {items.map((e) => (
                <li key={e.id} className="flex min-h-14 items-center justify-between px-4">
                  <span>{e.name}</span>
                  {e.equipment && <span className="text-sm text-neutral-500">{e.equipment}</span>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
