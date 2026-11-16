import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../../components/Layout';
import { Button, Sheet } from '../../components/ui';
import { db } from '../../db/db';
import { lastSessionByRoutine, startSession } from '../../db/sessions';
import { formatRelativeDay } from '../../lib/format';

export function StartScreen({ banner, onDismissBanner }: { banner?: string; onDismissBanner: () => void }) {
  const [choosing, setChoosing] = useState(false);
  const [starting, setStarting] = useState(false);

  const data = useLiveQuery(async () => {
    const [routines, last, latest] = await Promise.all([
      db.routines.orderBy('order').toArray(),
      lastSessionByRoutine(),
      db.sessions.orderBy('startedAt').reverse().filter((s) => !!s.finishedAt).first(),
    ]);
    // Suggest the routine after the one done most recently (cycling through the list).
    let suggestedId = routines[0]?.id;
    if (latest?.routineId) {
      const idx = routines.findIndex((r) => r.id === latest.routineId);
      if (idx >= 0) suggestedId = routines[(idx + 1) % routines.length].id;
    }
    const latestName = latest ? (routines.find((r) => r.id === latest.routineId)?.name ?? 'Sesión libre') : undefined;
    return { routines, last, suggestedId, latest, latestName };
  });

  const start = async (routineId?: string) => {
    if (starting) return;
    setStarting(true);
    try {
      onDismissBanner();
      await startSession(routineId);
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <PageHeader title="Entrenar" />
      <div className="flex flex-col gap-4 p-4">
        {banner && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-lime-950/70 p-4 text-lime-100">
            <span>{banner}</span>
            <button type="button" onClick={onDismissBanner} aria-label="Cerrar aviso" className="h-12 w-12 shrink-0 rounded-full">
              ✕
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="min-h-24 w-full rounded-2xl bg-accent text-2xl font-bold text-neutral-950 active:bg-accent-strong"
        >
          Empezar entrenamiento
        </button>
        {data?.latest && (
          <p className="text-center text-neutral-400">
            Último: <span className="text-neutral-200">{data.latestName}</span> · {formatRelativeDay(data.latest.date)}
          </p>
        )}
      </div>

      {choosing && data && (
        <Sheet title="¿Qué entrenás hoy?" onClose={() => setChoosing(false)}>
          <ul className="flex flex-col gap-2 p-4">
            {data.routines.map((r) => {
              const last = data.last.get(r.id);
              const suggested = r.id === data.suggestedId;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => start(r.id)}
                    className={`flex min-h-18 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left active:bg-neutral-800 ${
                      suggested ? 'bg-neutral-800 ring-2 ring-accent' : 'bg-neutral-900'
                    }`}
                  >
                    <span>
                      <span className="block text-lg font-semibold">{r.name}</span>
                      <span className="block text-sm text-neutral-500">
                        {last ? `Última vez: ${formatRelativeDay(last.date)}` : 'Sin registros todavía'}
                      </span>
                    </span>
                    {suggested && <span className="rounded-full bg-accent px-2 py-1 text-xs font-bold text-neutral-950">Sugerida</span>}
                  </button>
                </li>
              );
            })}
            <li>
              <Button className="mt-2 w-full" disabled={starting} onClick={() => start()}>
                Sesión libre (sin rutina)
              </Button>
            </li>
          </ul>
        </Sheet>
      )}
    </>
  );
}
