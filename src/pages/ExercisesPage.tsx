import { useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/Layout';
import { GroupedExercises, SearchBox } from '../components/ExerciseList';
import { ChevronIcon, PlusIcon } from '../components/icons';
import { db } from '../db/db';

export function ExercisesPage() {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const all = useLiveQuery(() => db.exercises.toArray(), []);
  const archivedCount = all?.filter((e) => e.archived).length ?? 0;
  const exercises = (all ?? []).filter((e) => e.archived === showArchived);

  return (
    <>
      <PageHeader
        title={showArchived ? 'Archivados' : 'Ejercicios'}
        action={
          <Link
            to="/ejercicios/nuevo"
            aria-label="Nuevo ejercicio"
            className="flex h-12 w-12 items-center justify-center rounded-full text-accent active:bg-neutral-800"
          >
            <PlusIcon />
          </Link>
        }
      />
      <SearchBox value={query} onChange={setQuery} />
      {all && (
        <GroupedExercises
          exercises={exercises}
          query={query}
          empty={showArchived ? 'No hay ejercicios archivados.' : 'No se encontraron ejercicios.'}
          renderRow={(e) => (
            <Link to={`/ejercicios/${e.id}`} className="flex min-h-14 items-center gap-3 px-4 active:bg-neutral-900">
              <span className="flex-1">{e.name}</span>
              {e.equipment && <span className="text-sm text-neutral-500">{e.equipment}</span>}
              <ChevronIcon className="text-neutral-600" />
            </Link>
          )}
        />
      )}
      {(archivedCount > 0 || showArchived) && (
        <div className="p-4">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="min-h-12 w-full rounded-xl text-neutral-400 active:bg-neutral-900"
          >
            {showArchived ? 'Volver a los ejercicios activos' : `Ver archivados (${archivedCount})`}
          </button>
        </div>
      )}
    </>
  );
}
