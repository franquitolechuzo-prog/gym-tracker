import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/Layout';
import { Button, Field, Segmented, Toggle, inputClass } from '../components/ui';
import { useConfirm } from '../components/confirm';
import { db } from '../db/db';
import { MUSCLE_GROUPS, type MuscleGroup, type WeightUnit } from '../db/types';
import {
  ValidationError,
  createExercise,
  deleteOrArchiveExercise,
  isExerciseInHistory,
  restoreExercise,
  updateExercise,
  type ExerciseInput,
} from '../db/exercises';
import { useSettings } from '../db/settings';

const EQUIPMENT = ['Barra', 'Mancuernas', 'Máquina', 'Polea', 'Peso corporal', 'Banco', 'Barra Z', 'Kettlebell', 'Banda'];

export function ExerciseFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const confirm = useConfirm();
  const settings = useSettings();

  // `null` = not found; `undefined` = still loading.
  const existing = useLiveQuery(async () => (id ? ((await db.exercises.get(id)) ?? null) : null), [id]);
  const inHistory = useLiveQuery(async () => (id ? isExerciseInHistory(id) : false), [id], false);
  const usedInRoutines = useLiveQuery(async () => (id ? db.routineExercises.where('exerciseId').equals(id).count() : 0), [id], 0);

  const [form, setForm] = useState<ExerciseInput>({
    name: '',
    muscleGroup: 'Piernas',
    unit: settings.unit,
    isBodyweight: false,
    equipment: '',
    notes: '',
  });
  const [loaded, setLoaded] = useState(isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing && !loaded) {
      setForm({
        name: existing.name,
        muscleGroup: existing.muscleGroup,
        unit: existing.unit,
        isBodyweight: existing.isBodyweight,
        equipment: existing.equipment ?? '',
        notes: existing.notes ?? '',
      });
      setLoaded(true);
    }
  }, [existing, loaded]);

  const set = <K extends keyof ExerciseInput>(key: K, value: ExerciseInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (isNew) await createExercise(form);
      else await updateExercise(id, form);
      navigate(-1);
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : 'No se pudo guardar.');
    }
  };

  const onDelete = async () => {
    if (!id || !existing) return;
    const ok = await confirm(
      inHistory
        ? {
            title: `¿Archivar "${existing.name}"?`,
            message: 'Este ejercicio está en tu historial, así que se archiva: deja de aparecer en las listas pero sus registros se conservan. Podés restaurarlo cuando quieras.',
            confirmLabel: 'Archivar',
            danger: true,
          }
        : {
            title: `¿Eliminar "${existing.name}"?`,
            message:
              usedInRoutines > 0
                ? `No tiene registros, así que se elimina. También se quita de ${usedInRoutines} rutina${usedInRoutines > 1 ? 's' : ''}.`
                : 'No tiene registros, así que se elimina definitivamente.',
            confirmLabel: 'Eliminar',
            danger: true,
          },
    );
    if (!ok) return;
    await deleteOrArchiveExercise(id);
    navigate(-1);
  };

  const onRestore = async () => {
    if (!id) return;
    try {
      await restoreExercise(id);
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : 'No se pudo restaurar.');
    }
  };

  if (!isNew && existing === null) {
    return (
      <>
        <PageHeader title="Ejercicio" back />
        <p className="p-4 text-neutral-500">Este ejercicio no existe.</p>
      </>
    );
  }
  if (!loaded) return <PageHeader title="Ejercicio" back />;

  return (
    <>
      <PageHeader title={isNew ? 'Nuevo ejercicio' : 'Editar ejercicio'} back />
      {existing?.archived && (
        <div className="m-4 flex items-center justify-between gap-3 rounded-xl bg-amber-950/60 p-3 text-amber-100">
          <span>Este ejercicio está archivado.</span>
          <Button variant="secondary" onClick={onRestore}>
            Restaurar
          </Button>
        </div>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-5 p-4" noValidate>
        <Field label="Nombre" htmlFor="ex-name">
          <input
            id="ex-name"
            className={inputClass}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            autoFocus={isNew}
            autoCapitalize="sentences"
            enterKeyHint="next"
            required
          />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-neutral-400">Grupo muscular</legend>
          <div className="grid grid-cols-3 gap-2">
            {MUSCLE_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={form.muscleGroup === g}
                onClick={() => set('muscleGroup', g as MuscleGroup)}
                className={`min-h-12 rounded-xl px-2 font-medium ${
                  form.muscleGroup === g ? 'bg-accent text-neutral-950' : 'bg-neutral-900 text-neutral-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Equipamiento (opcional)" htmlFor="ex-equipment">
          <input
            id="ex-equipment"
            className={inputClass}
            value={form.equipment ?? ''}
            onChange={(e) => set('equipment', e.target.value)}
            list="equipment-options"
            autoCapitalize="sentences"
          />
          <datalist id="equipment-options">
            {EQUIPMENT.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-400">Unidad</span>
          <Segmented<WeightUnit>
            label="Unidad"
            value={form.unit}
            onChange={(v) => set('unit', v)}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />
        </div>

        <Toggle
          checked={form.isBodyweight}
          onChange={(v) => set('isBodyweight', v)}
          label="Peso corporal"
          description="El peso que cargás es el adicional: 0 sin lastre, negativo si es asistido."
        />

        <Field label="Notas (opcional)" htmlFor="ex-notes">
          <textarea
            id="ex-notes"
            rows={3}
            className={`${inputClass} h-auto py-3`}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-xl bg-red-950/60 p-3 text-red-200">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" className="min-h-14 text-lg">
          Guardar
        </Button>
        {!isNew && !existing?.archived && (
          <Button variant="ghost" className="text-red-300" onClick={onDelete}>
            {inHistory ? 'Archivar ejercicio' : 'Eliminar ejercicio'}
          </Button>
        )}
      </form>
    </>
  );
}
