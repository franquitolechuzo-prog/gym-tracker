import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/Layout';
import { Segmented } from '../components/ui';
import { ChevronIcon } from '../components/icons';
import { SearchBox } from '../components/ExerciseList';
import { listExercisesWithHistory, listSessionSummaries } from '../db/history';
import { formatLongDate, formatRelativeDay, formatWeight, matchesSearch } from '../lib/format';

type View = 'historial' | 'ejercicios';

export function ProgressPage() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get('vista') === 'ejercicios' ? 'ejercicios' : 'historial';

  return (
    <>
      <PageHeader title="Progreso" />
      <div className="px-4 pt-4">
        <Segmented<View>
          label="Vista"
          value={view}
          onChange={(v) => setParams(v === 'historial' ? {} : { vista: v }, { replace: true })}
          options={[
            { value: 'historial', label: 'Historial' },
            { value: 'ejercicios', label: 'Por ejercicio' },
          ]}
        />
      </div>
      {view === 'historial' ? <HistoryList /> : <ExerciseProgressList />}
    </>
  );
}

const monthFormat = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });

function HistoryList() {
  const summaries = useLiveQuery(() => listSessionSummaries(), []);
  if (!summaries) return null;
  if (summaries.length === 0) {
    return <p className="p-6 text-center text-neutral-500">Todavía no registraste entrenamientos. Cuando termines uno, aparece acá.</p>;
  }

  // Group by month for scanning long histories.
  const groups: { month: string; items: typeof summaries }[] = [];
  for (const s of summaries) {
    const [y, m] = s.session.date.split('-').map(Number);
    const month = monthFormat.format(new Date(y, m - 1, 1));
    if (groups.at(-1)?.month !== month) groups.push({ month, items: [] });
    groups.at(-1)!.items.push(s);
  }

  return (
    <div className="pt-4">
      {groups.map((g) => (
        <section key={g.month} aria-label={g.month}>
          <h2 className="bg-neutral-900 px-4 py-2 text-sm font-semibold tracking-wide text-neutral-400 uppercase">{g.month}</h2>
          <ul className="divide-y divide-neutral-900">
            {g.items.map((s) => (
              <li key={s.session.id}>
                <Link to={`/progreso/sesion/${s.session.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-neutral-900">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-lg font-semibold">{s.title}</span>
                      <span className="shrink-0 text-sm text-neutral-400">{formatLongDate(s.session.date)}</span>
                    </span>
                    <span className="block truncate text-sm text-neutral-500">{s.exerciseNames.join(' · ')}</span>
                    <span className="block text-sm text-neutral-500">
                      {[
                        `${s.setCount} series`,
                        s.volume > 0 ? `${formatWeight(Math.round(s.volume))} kg de volumen` : null,
                        s.durationMinutes ? `${s.durationMinutes} min` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <ChevronIcon className="shrink-0 text-neutral-600" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ExerciseProgressList() {
  const [query, setQuery] = useState('');
  const items = useLiveQuery(() => listExercisesWithHistory(), []);
  if (!items) return null;
  if (items.length === 0) {
    return <p className="p-6 text-center text-neutral-500">Cuando registres entrenamientos vas a ver el progreso de cada ejercicio acá.</p>;
  }
  const visible = items.filter((i) => matchesSearch(i.exercise.name, query));
  return (
    <>
      <SearchBox value={query} onChange={setQuery} id="progress-search" />
      <ul className="divide-y divide-neutral-900">
        {visible.map(({ exercise, sessionCount, lastDate }) => (
          <li key={exercise.id}>
            <Link to={`/progreso/ejercicio/${exercise.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-neutral-900">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {exercise.name}
                  {exercise.archived && <span className="text-neutral-500"> (archivado)</span>}
                </span>
                <span className="block text-sm text-neutral-500">
                  {sessionCount} {sessionCount === 1 ? 'sesión' : 'sesiones'} · última {formatRelativeDay(lastDate)}
                </span>
              </span>
              <ChevronIcon className="text-neutral-600" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
