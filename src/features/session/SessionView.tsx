import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../../components/Layout';
import { Button } from '../../components/ui';
import { PlusIcon } from '../../components/icons';
import { useConfirm } from '../../components/confirm';
import { ExercisePicker } from '../../components/ExercisePicker';
import { db } from '../../db/db';
import type { Session } from '../../db/types';
import {
  addExerciseToSession,
  deleteSession,
  finishSession,
  getSessionCounts,
  listSessionExercises,
  replaceSessionExercise,
  updateSession,
} from '../../db/sessions';
import { ExerciseCard } from './ExerciseCard';
import { formatClock, stopRest } from './restTimer';
import { useWakeLock } from './useWakeLock';

type PickerState = { mode: 'add' } | { mode: 'replace'; sessionExerciseId: string } | null;

export function SessionView({ session, onFinished }: { session: Session; onFinished: (message: string) => void }) {
  useWakeLock(true);
  const confirm = useConfirm();
  const [picker, setPicker] = useState<PickerState>(null);
  const [toast, setToast] = useState<string>();
  const [notes, setNotes] = useState(session.notes ?? '');

  const data = useLiveQuery(async () => {
    const [routine, items] = await Promise.all([
      session.routineId ? db.routines.get(session.routineId) : undefined,
      listSessionExercises(session.id),
    ]);
    return { routine, items };
  }, [session.id, session.routineId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const title = session.routineId ? (data?.routine?.name ?? 'Rutina eliminada') : 'Sesión libre';

  const onFinish = async () => {
    const { done, pending } = await getSessionCounts(session.id);
    const ok = await confirm({
      title: '¿Terminar entrenamiento?',
      message:
        done === 0
          ? 'No marcaste ninguna serie como hecha, así que el entrenamiento no se va a guardar.'
          : `${done} serie${done === 1 ? '' : 's'} hecha${done === 1 ? '' : 's'}.${
              pending > 0 ? ` Las ${pending} sin marcar se descartan.` : ''
            }`,
      confirmLabel: 'Terminar',
    });
    if (!ok) return;
    await updateSession(session.id, { notes });
    const result = await finishSession(session.id);
    await stopRest();
    onFinished(result === 'saved' ? '¡Entrenamiento guardado! 💪' : 'No había series hechas: el entrenamiento no se guardó.');
  };

  const onDiscard = async () => {
    const ok = await confirm({
      title: '¿Descartar entrenamiento?',
      message: 'Se borra todo lo registrado en esta sesión.',
      confirmLabel: 'Descartar',
      danger: true,
    });
    if (!ok) return;
    await deleteSession(session.id);
    await stopRest();
    onFinished('Entrenamiento descartado.');
  };

  return (
    <>
      <PageHeader
        title={title}
        action={
          <Button variant="primary" className="px-3" onClick={onFinish}>
            Terminar
          </Button>
        }
        showSettings={false}
      />
      <p className="px-4 pt-2 text-sm text-neutral-500">
        En curso · <Elapsed since={session.startedAt} />
      </p>

      {toast && (
        <div role="status" className="sticky top-16 z-20 mx-3 mt-2 rounded-xl bg-amber-900 p-3 font-semibold text-amber-50 shadow-lg shadow-black">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-3 p-3">
        {data?.items.length === 0 && (
          <p className="py-6 text-center text-neutral-500">Agregá un ejercicio para empezar.</p>
        )}
        {data?.items.map((item, i) => (
          <ExerciseCard
            key={item.id}
            item={item}
            session={session}
            isFirst={i === 0}
            isLast={i === data.items.length - 1}
            onReplace={() => setPicker({ mode: 'replace', sessionExerciseId: item.id })}
            onRecord={setToast}
          />
        ))}

        <Button variant="secondary" className="min-h-14" onClick={() => setPicker({ mode: 'add' })}>
          <PlusIcon /> Agregar ejercicio
        </Button>

        <div className="mt-2">
          <label htmlFor="session-notes" className="mb-1.5 block text-sm font-medium text-neutral-400">
            Notas de la sesión
          </label>
          <textarea
            id="session-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => updateSession(session.id, { notes })}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-base outline-none focus:border-accent"
          />
        </div>

        <Button variant="primary" className="min-h-14 text-lg" onClick={onFinish}>
          Terminar entrenamiento
        </Button>
        <Button variant="ghost" className="text-red-300" onClick={onDiscard}>
          Descartar entrenamiento
        </Button>
        {/* Room for the floating rest timer. */}
        <div className="h-24" aria-hidden />
      </div>

      {picker && (
        <ExercisePicker
          title={picker.mode === 'add' ? 'Agregar ejercicio' : 'Reemplazar ejercicio'}
          onClose={() => setPicker(null)}
          onPick={(exerciseId) =>
            picker.mode === 'add'
              ? addExerciseToSession(session.id, exerciseId)
              : replaceSessionExercise(picker.sessionExerciseId, exerciseId)
          }
        />
      )}
    </>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{formatClock((now - since) / 1000)}</span>;
}
