import type { ReactNode } from 'react';
import { MUSCLE_GROUPS, type Exercise } from '../db/types';
import { matchesSearch } from '../lib/format';

/** Filters by search query and groups by muscle group, alphabetically within each group. */
export function groupExercises(exercises: Exercise[], query: string) {
  const visible = exercises
    .filter((e) => matchesSearch(`${e.name} ${e.equipment ?? ''} ${e.muscleGroup}`, query))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return MUSCLE_GROUPS.map((group) => ({ group, items: visible.filter((e) => e.muscleGroup === group) })).filter(
    (g) => g.items.length > 0,
  );
}

export function SearchBox({ value, onChange, id = 'exercise-search' }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className="p-4">
      <label className="sr-only" htmlFor={id}>
        Buscar ejercicio
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar…"
        autoComplete="off"
        className="h-12 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 text-base outline-none focus:border-accent"
      />
    </div>
  );
}

/** Grouped exercise list; `renderRow` draws each row's content. */
export function GroupedExercises({
  exercises,
  query,
  renderRow,
  empty,
}: {
  exercises: Exercise[];
  query: string;
  renderRow: (e: Exercise) => ReactNode;
  empty?: ReactNode;
}) {
  const groups = groupExercises(exercises, query);
  if (groups.length === 0) return <p className="px-4 py-8 text-center text-neutral-500">{empty ?? 'Sin resultados.'}</p>;
  return (
    <>
      {groups.map(({ group, items }) => (
        <section key={group} aria-labelledby={`group-${group}`}>
          <h2
            id={`group-${group}`}
            className="bg-neutral-900 px-4 py-2 text-sm font-semibold tracking-wide text-neutral-400 uppercase"
          >
            {group}
          </h2>
          <ul className="divide-y divide-neutral-900">
            {items.map((e) => (
              <li key={e.id}>{renderRow(e)}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
