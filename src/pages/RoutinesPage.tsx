import { Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/Layout';
import { SortableList } from '../components/SortableList';
import { Button } from '../components/ui';
import { ChevronIcon, PlusIcon } from '../components/icons';
import { db } from '../db/db';
import { createRoutine, listRoutineExercises, reorderRoutines } from '../db/routines';

export function RoutinesPage() {
  const navigate = useNavigate();
  const routines = useLiveQuery(async () => {
    const [list, exercises] = await Promise.all([db.routines.orderBy('order').toArray(), db.exercises.toArray()]);
    const names = new Map(exercises.map((e) => [e.id, e.name]));
    return Promise.all(
      list.map(async (r) => {
        const items = await listRoutineExercises(r.id);
        return { ...r, summary: items.map((i) => names.get(i.exerciseId) ?? '?').join(' · '), count: items.length };
      }),
    );
  });

  const onNew = async () => {
    const r = await createRoutine('Nueva rutina');
    navigate(`/rutinas/${r.id}?nueva=1`);
  };

  return (
    <>
      <PageHeader
        title="Rutinas"
        action={
          <button
            type="button"
            onClick={onNew}
            aria-label="Nueva rutina"
            className="flex h-12 w-12 items-center justify-center rounded-full text-accent active:bg-neutral-800"
          >
            <PlusIcon />
          </button>
        }
      />
      {routines && routines.length === 0 && (
        <div className="p-6 text-center">
          <p className="text-neutral-500">Todavía no tenés rutinas.</p>
          <Button variant="primary" className="mt-4" onClick={onNew}>
            Crear rutina
          </Button>
        </div>
      )}
      {routines && (
        <SortableList
          items={routines}
          onReorder={reorderRoutines}
          className="divide-y divide-neutral-900"
          renderItem={(r, handle) => (
            <div className="flex items-center pl-1">
              {handle}
              <Link to={`/rutinas/${r.id}`} className="flex min-h-18 min-w-0 flex-1 items-center gap-2 py-3 pr-4 active:bg-neutral-900">
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold">{r.name}</span>
                  <span className="block truncate text-sm text-neutral-500">
                    {r.count === 0 ? 'Sin ejercicios' : `${r.count} · ${r.summary}`}
                  </span>
                </span>
                <ChevronIcon className="text-neutral-600" />
              </Link>
            </div>
          )}
        />
      )}
      {routines && routines.length > 1 && (
        <p className="px-4 py-3 text-center text-sm text-neutral-600">Arrastrá ⋮⋮ para cambiar el orden.</p>
      )}
    </>
  );
}
