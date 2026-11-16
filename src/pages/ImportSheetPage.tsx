import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/Layout';
import { Button, Toggle, inputClass } from '../components/ui';
import { db } from '../db/db';
import { MUSCLE_GROUPS, type MuscleGroup } from '../db/types';
import { formatLongDate, formatWeight } from '../lib/format';
import { parseSheetDate, type ParsedGroup } from '../import/gymSheet';
import { importGroups, suggestMapping, uniqueExerciseNames, type ExerciseChoice, type ImportResult } from '../import/importGym';
import { readGymWorkbook } from '../import/readWorkbook';

interface ReviewGroup extends ParsedGroup {
  include: boolean;
  alternative?: string;
  /** The user picked this date by hand; don't recompute it when the year changes. */
  userDate?: boolean;
}

/** Abbreviated dates (12/11) have no year: they are placed on or before this anchor. */
function anchorFor(year: number | 'today'): Date {
  return year === 'today' ? new Date() : new Date(year, 11, 31);
}

function withDates(groups: ReviewGroup[], year: number | 'today'): ReviewGroup[] {
  const anchor = anchorFor(year);
  return groups.map((g) => {
    if (g.userDate || !g.dateRaw) return g;
    const p = parseSheetDate(g.dateRaw, anchor);
    return { ...g, date: p.date, alternative: p.alternative };
  });
}

export function ImportSheetPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>();
  const [groups, setGroups] = useState<ReviewGroup[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Map<string, ExerciseChoice>>(new Map());
  const [skipExisting, setSkipExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ImportResult>();
  const [year, setYear] = useState<number | 'today'>('today');
  const thisYear = new Date().getFullYear();

  const changeYear = (y: number | 'today') => {
    setYear(y);
    setGroups((gs) => (gs ? withDates(gs, y) : gs));
  };

  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const existingDates = useLiveQuery(async () => new Set((await db.sessions.filter((s) => !!s.finishedAt).toArray()).map((s) => s.date)), []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const parsed = await readGymWorkbook(file);
      const review = withDates(
        parsed.groups.map((g) => ({ ...g, include: true })),
        year,
      );
      setGroups(review);
      setWarnings(parsed.warnings);
      setMapping(suggestMapping(uniqueExerciseNames(review), (await db.exercises.toArray()) ?? []));
      setFileName(file.name);
    } catch (err) {
      console.error(err);
      setError('No se pudo leer el archivo. ¿Es una planilla de Excel (.xlsx)?');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const update = (id: string, patch: Partial<ReviewGroup>) =>
    setGroups((gs) => gs?.map((g) => (g.id === id ? { ...g, ...patch } : g)) ?? null);

  const included = useMemo(() => groups?.filter((g) => g.include) ?? [], [groups]);
  const needsDate = included.filter((g) => !g.date);
  const toReview = (groups ?? []).filter((g) => g.dateStatus !== 'ok');
  const names = useMemo(() => uniqueExerciseNames(included), [included]);
  const setTotal = included.reduce((n, g) => n + g.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
  const dates = new Set(included.map((g) => g.date).filter(Boolean));
  const duplicateDates = [...dates].filter((d) => existingDates?.has(d!));

  const onImport = async () => {
    if (!groups) return;
    setBusy(true);
    setError(undefined);
    try {
      setResult(await importGroups(included, mapping, { skipExistingDates: skipExisting }));
      setGroups(null);
    } catch (err) {
      console.error(err);
      setError('No se pudo importar. No se guardó nada.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Importar planilla" back />
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="flex flex-col gap-4 p-4">
        {result && (
          <div role="status" className="rounded-xl bg-lime-950/70 p-4 text-lime-100">
            <p className="font-semibold">¡Listo! Se importaron {result.sessions} sesiones con {result.sets} series.</p>
            {result.exercisesCreated > 0 && (
              <p>
                {result.exercisesCreated === 1 ? 'Se creó 1 ejercicio nuevo.' : `Se crearon ${result.exercisesCreated} ejercicios nuevos.`}
              </p>
            )}
            {result.skippedDates.length > 0 && (
              <p>Se omitieron {result.skippedDates.length} fechas que ya tenían entrenamientos.</p>
            )}
            <Link to="/progreso" className="mt-2 inline-block font-semibold underline">
              Ver historial
            </Link>
          </div>
        )}

        {!groups && (
          <>
            <p className="text-neutral-400">
              Elegí tu planilla (por ejemplo <strong>GYM.xlsx</strong>). Antes de guardar vas a ver una vista previa para revisar fechas y
              ejercicios.
            </p>
            <Button variant="primary" className="min-h-14" disabled={busy} onClick={() => fileInput.current?.click()}>
              {busy ? 'Leyendo…' : 'Elegir archivo'}
            </Button>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-950/60 p-3 text-red-200">
            {error}
          </p>
        )}

        {groups && (
          <>
            <div className="rounded-xl bg-neutral-900 p-4">
              <p className="font-semibold">{fileName}</p>
              <p className="text-neutral-400">
                {included.length} bloques · {dates.size} fechas · {setTotal} series · {names.length} ejercicios
              </p>
              {warnings.map((w) => (
                <p key={w} className="mt-1 text-sm text-amber-300">
                  {w}
                </p>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="import-year" className="text-sm font-medium text-neutral-400">
                Año de las fechas abreviadas (ej. “1211”)
              </label>
              <select
                id="import-year"
                className={inputClass}
                value={String(year)}
                onChange={(e) => changeYear(e.target.value === 'today' ? 'today' : Number(e.target.value))}
              >
                <option value="today">Las más recientes hasta hoy</option>
                {[0, 1, 2, 3].map((k) => (
                  <option key={k} value={thisYear - k}>
                    Hasta el 31/12/{thisYear - k}
                  </option>
                ))}
              </select>
              <p className="text-sm text-neutral-500">Revisá que las fechas de la vista previa tengan el año correcto.</p>
            </div>

            {toReview.length > 0 && (
              <section aria-labelledby="review-dates" className="flex flex-col gap-2">
                <h2 id="review-dates" className="text-sm font-semibold tracking-wide text-amber-300 uppercase">
                  Fechas para revisar ({toReview.length})
                </h2>
                <p className="text-sm text-neutral-400">
                  En estos bloques la columna A no se pudo leer como fecha o admite dos lecturas. Elegí la fecha, o desmarcá el bloque para no
                  importarlo.
                </p>
                {toReview.map((g) => (
                  <GroupCard key={g.id} group={g} onChange={(p) => update(g.id, p)} highlight />
                ))}
              </section>
            )}

            <section aria-labelledby="map-exercises" className="flex flex-col gap-2">
              <h2 id="map-exercises" className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">
                Ejercicios
              </h2>
              <ul className="divide-y divide-neutral-800 rounded-xl bg-neutral-900">
                {names.map((name) => (
                  <MappingRow
                    key={name}
                    name={name}
                    choice={mapping.get(name)}
                    exercises={exercises ?? []}
                    onChange={(c) => setMapping((m) => new Map(m).set(name, c))}
                  />
                ))}
              </ul>
            </section>

            <section aria-labelledby="all-groups" className="flex flex-col gap-2">
              <h2 id="all-groups" className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">
                Vista previa ({groups.length} bloques)
              </h2>
              {groups
                .filter((g) => g.dateStatus === 'ok')
                .map((g) => (
                  <GroupCard key={g.id} group={g} onChange={(p) => update(g.id, p)} />
                ))}
            </section>

            {duplicateDates.length > 0 && (
              <Toggle
                checked={skipExisting}
                onChange={setSkipExisting}
                label="Omitir fechas que ya tienen entrenamientos"
                description={`${duplicateDates.length} fecha${duplicateDates.length > 1 ? 's' : ''} ya existe${duplicateDates.length > 1 ? 'n' : ''} en el historial (útil si importás dos veces).`}
              />
            )}

            {needsDate.length > 0 && (
              <p role="alert" className="text-amber-300">
                Faltan fechas en {needsDate.length} bloque{needsDate.length > 1 ? 's' : ''}.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setGroups(null)}>Cancelar</Button>
              <Button variant="primary" disabled={busy || needsDate.length > 0 || included.length === 0} onClick={onImport}>
                {busy ? 'Importando…' : 'Importar'}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function GroupCard({ group, onChange, highlight = false }: { group: ReviewGroup; onChange: (p: Partial<ReviewGroup>) => void; highlight?: boolean }) {
  const rows = group.firstRow === group.lastRow ? `fila ${group.firstRow}` : `filas ${group.firstRow}–${group.lastRow}`;
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-amber-950/40 ring-1 ring-amber-800' : 'bg-neutral-900'} ${group.include ? '' : 'opacity-50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{group.date ? formatLongDate(group.date) : 'Sin fecha'}</p>
          <p className="text-sm text-neutral-500">
            Hoja “{group.sheet}”, {rows}
            {group.dateRaw && ` · columna A: “${group.dateRaw}”`}
          </p>
        </div>
        <label className="flex min-h-12 shrink-0 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={group.include}
            onChange={(e) => onChange({ include: e.target.checked })}
            className="h-6 w-6 accent-lime-500"
          />
          Incluir
        </label>
      </div>
      {highlight && group.include && (
        <div className="mt-2 flex flex-col gap-2">
          {group.alternative && group.date && (
            <div className="grid grid-cols-2 gap-2">
              {[group.date, group.alternative].map((d) => (
                <Button key={d} variant={group.date === d ? 'primary' : 'secondary'} aria-pressed={group.date === d} onClick={() => onChange({ userDate: true, date: d, alternative: group.date === d ? group.alternative : group.date })}>
                  {formatLongDate(d)}
                </Button>
              ))}
            </div>
          )}
          <label className="sr-only" htmlFor={`date-${group.id}`}>
            Fecha del bloque {rows}
          </label>
          <input
            id={`date-${group.id}`}
            type="date"
            className={inputClass}
            value={group.date ?? ''}
            onChange={(e) => onChange({ userDate: true, date: e.target.value || undefined })}
          />
        </div>
      )}
      <ul className="mt-2 text-sm text-neutral-300">
        {group.exercises.map((e) => (
          <li key={e.name}>
            <span className="font-medium">{e.name}:</span>{' '}
            {e.sets.map((s) => `${formatWeight(s.weight)}×${s.reps}`).join(' · ') || '—'}
            {e.notes.length > 0 && <span className="text-neutral-500 italic"> (nota: {e.notes.join('; ')})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MappingRow({
  name,
  choice,
  exercises,
  onChange,
}: {
  name: string;
  choice: ExerciseChoice | undefined;
  exercises: { id: string; name: string; archived: boolean }[];
  onChange: (c: ExerciseChoice) => void;
}) {
  const value = choice?.kind === 'existing' ? choice.exerciseId : `new:${choice?.muscleGroup ?? 'Otro'}`;
  const sorted = [...exercises].filter((e) => !e.archived).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return (
    <li className="flex flex-col gap-1.5 p-3">
      <label htmlFor={`map-${name}`} className="font-medium">
        {name}
        {choice?.kind === 'new' && <span className="ml-2 rounded bg-sky-900 px-1.5 py-0.5 text-xs text-sky-100">nuevo</span>}
      </label>
      <select
        id={`map-${name}`}
        className={inputClass}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v.startsWith('new:') ? { kind: 'new', muscleGroup: v.slice(4) as MuscleGroup } : { kind: 'existing', exerciseId: v });
        }}
      >
        <optgroup label="Crear ejercicio nuevo">
          {MUSCLE_GROUPS.map((g) => (
            <option key={g} value={`new:${g}`}>
              Nuevo — {g}
            </option>
          ))}
        </optgroup>
        <optgroup label="Usar un ejercicio existente">
          {sorted.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </optgroup>
      </select>
    </li>
  );
}
