import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/Layout';
import { db } from '../db/db';

export function RoutinesPage() {
  const routines = useLiveQuery(async () => {
    const list = await db.routines.orderBy('order').toArray();
    return Promise.all(
      list.map(async (r) => ({ ...r, count: await db.routineExercises.where('routineId').equals(r.id).count() })),
    );
  });

  return (
    <>
      <PageHeader title="Rutinas" />
      <ul className="divide-y divide-neutral-900">
        {routines?.map((r) => (
          <li key={r.id} className="flex min-h-16 items-center justify-between px-4">
            <span className="text-lg font-medium">{r.name}</span>
            <span className="text-sm text-neutral-500">{r.count} ejercicios</span>
          </li>
        ))}
      </ul>
    </>
  );
}
