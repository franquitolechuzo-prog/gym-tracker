import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/Layout';
import { Segmented } from '../components/ui';
import { ChevronIcon } from '../components/icons';
import { db } from '../db/db';
import { getExerciseHistory } from '../db/sessions';
import { formatLongDate, formatRelativeDay, formatWeight } from '../lib/format';
import { formatSet } from '../lib/progress';
import { exerciseSeries, recordsDetail } from '../lib/stats';
import { METRIC_LABELS, ProgressChart, type Metric } from '../features/progress/ProgressChart';

export function ExerciseDetailPage() {
  const { id = '' } = useParams();
  const [metric, setMetric] = useState<Metric>('best1RM');
  const exercise = useLiveQuery(async () => (await db.exercises.get(id)) ?? null, [id]);
  const history = useLiveQuery(() => getExerciseHistory(id), [id]);

  const dated = useMemo(() => (history ?? []).map((h) => ({ date: h.session.date, sets: h.sets })), [history]);
  const series = useMemo(() => exerciseSeries(dated), [dated]);
  const records = useMemo(() => recordsDetail(dated), [dated]);

  if (exercise === null) {
    return (
      <>
        <PageHeader title="Ejercicio" back />
        <p className="p-4 text-neutral-500">Este ejercicio no existe.</p>
      </>
    );
  }
  if (!exercise || !history) return <PageHeader title="Ejercicio" back />;

  const unit = exercise.unit;
  const fmt = (w: number, r: number) => formatSet(w, r, unit, exercise.isBodyweight);

  return (
    <>
      <PageHeader
        title={exercise.name}
        back
        action={
          <Link to={`/ejercicios/${exercise.id}/editar`} className="flex h-12 items-center rounded-full px-3 font-semibold text-accent active:bg-neutral-800">
            Editar
          </Link>
        }
      />
      {exercise.archived && <p className="mx-4 mt-3 rounded-xl bg-amber-950/60 p-3 text-amber-100">Ejercicio archivado.</p>}

      {history.length === 0 ? (
        <p className="p-6 text-center text-neutral-500">Todavía no hay registros de este ejercicio.</p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <section aria-labelledby="records-title">
            <h2 id="records-title" className="mb-2 text-sm font-semibold tracking-wide text-neutral-400 uppercase">
              Récords personales
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {records.maxWeight && (
                <StatTile
                  label={exercise.isBodyweight ? 'Lastre máximo' : 'Peso máximo'}
                  value={`${formatWeight(records.maxWeight.weight)} ${unit}`}
                  detail={`${fmt(records.maxWeight.weight, records.maxWeight.reps)} · ${formatRelativeDay(records.maxWeight.date)}`}
                />
              )}
              {records.best1RM && (
                <StatTile
                  label="Mejor 1RM estimado"
                  value={`${formatWeight(Math.round(records.best1RM.value * 10) / 10)} ${unit}`}
                  detail={`${fmt(records.best1RM.weight, records.best1RM.reps)} · ${formatRelativeDay(records.best1RM.date)}`}
                />
              )}
            </div>
          </section>

          {series.length > 0 && (
            <section aria-labelledby="chart-title" className="rounded-2xl bg-neutral-900 p-3">
              <h2 id="chart-title" className="mb-2 font-semibold">
                {METRIC_LABELS[metric]} por sesión
              </h2>
              <Segmented<Metric>
                label="Métrica"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'maxWeight', label: 'Peso máx.' },
                  { value: 'best1RM', label: '1RM est.' },
                  { value: 'volume', label: 'Volumen' },
                ]}
              />
              <div className="mt-3">
                <ProgressChart data={series} metric={metric} unit={unit} />
              </div>
              {metric === 'best1RM' && (
                <p className="mt-1 text-xs text-neutral-500">
                  Fórmula de Epley: peso × (1 + reps / 30).
                  {exercise.isBodyweight && ' En ejercicios con peso corporal se calcula sobre el lastre.'}
                </p>
              )}
              {metric === 'volume' && <p className="mt-1 text-xs text-neutral-500">Σ peso × reps, sin series de calentamiento.</p>}
            </section>
          )}

          {records.repsByWeight.length > 0 && (
            <section aria-labelledby="reps-title">
              <h2 id="reps-title" className="mb-2 text-sm font-semibold tracking-wide text-neutral-400 uppercase">
                Máximo de reps por peso
              </h2>
              <table className="w-full overflow-hidden rounded-2xl bg-neutral-900 text-left">
                <thead className="text-sm text-neutral-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {exercise.isBodyweight ? 'Lastre' : 'Peso'}
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Reps
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 tabular-nums">
                  {records.repsByWeight.slice(0, 12).map((r) => (
                    <tr key={r.weight}>
                      <td className="px-3 py-2 font-medium">
                        {exercise.isBodyweight
                          ? fmt(r.weight, 0).replace(/ × 0$/, '')
                          : `${formatWeight(r.weight)} ${unit}`}
                      </td>
                      <td className="px-3 py-2 text-right">{r.reps}</td>
                      <td className="px-3 py-2 text-right text-neutral-400">{formatRelativeDay(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section aria-labelledby="sessions-title">
            <h2 id="sessions-title" className="mb-2 text-sm font-semibold tracking-wide text-neutral-400 uppercase">
              Sesiones ({history.length})
            </h2>
            <ul className="divide-y divide-neutral-800 overflow-hidden rounded-2xl bg-neutral-900">
              {history.map((h) => (
                <li key={h.sessionExercise.id}>
                  <Link to={`/progreso/sesion/${h.session.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-neutral-800">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{formatLongDate(h.session.date)}</span>
                      <span className="block text-sm text-neutral-300">
                        {h.sets.map((s, i) => (
                          <span key={s.id} className={s.isWarmup ? 'text-neutral-500' : ''}>
                            {i > 0 && ' · '}
                            {exercise.isBodyweight ? fmt(s.weight, s.reps) : `${formatWeight(s.weight)}×${s.reps}`}
                            {s.isWarmup && ' (C)'}
                          </span>
                        ))}
                      </span>
                      {h.sessionExercise.notes && <span className="block text-sm text-neutral-500 italic">{h.sessionExercise.notes}</span>}
                    </span>
                    <ChevronIcon className="shrink-0 text-neutral-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-neutral-900 p-3">
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-500">{detail}</div>
    </div>
  );
}
