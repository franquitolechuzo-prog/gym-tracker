import { adjustRest, formatClock, stopRest, useRestTimer } from './restTimer';

/** Floating countdown shown above the bottom navigation while resting. */
export function RestTimerBar() {
  const timer = useRestTimer();
  if (!timer) return null;

  return (
    <div
      role="timer"
      aria-live={timer.finished ? 'assertive' : 'off'}
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2"
    >
      <div
        className={`mx-auto max-w-xl overflow-hidden rounded-2xl border shadow-lg shadow-black ${
          timer.finished ? 'border-accent bg-lime-950' : 'border-neutral-700 bg-neutral-900'
        }`}
      >
        <div className="h-1 bg-neutral-800">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.min(100, timer.progress * 100)}%` }} />
        </div>
        <div className="flex items-center gap-2 p-2">
          <button
            type="button"
            onClick={() => adjustRest(-15)}
            className="h-12 w-14 rounded-xl bg-neutral-800 font-semibold active:bg-neutral-700"
            aria-label="Restar 15 segundos"
          >
            −15
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-3xl leading-none font-bold tabular-nums">
              {timer.finished ? '¡Listo!' : formatClock(timer.remaining)}
            </div>
            <div className="truncate text-xs text-neutral-400">{timer.finished ? 'Fin del descanso' : (timer.label ?? 'Descanso')}</div>
          </div>
          <button
            type="button"
            onClick={() => adjustRest(15)}
            className="h-12 w-14 rounded-xl bg-neutral-800 font-semibold active:bg-neutral-700"
            aria-label="Sumar 15 segundos"
          >
            +15
          </button>
          <button
            type="button"
            onClick={() => stopRest()}
            className="h-12 rounded-xl px-3 font-semibold text-neutral-300 active:bg-neutral-800"
          >
            {timer.finished ? 'Cerrar' : 'Saltar'}
          </button>
        </div>
      </div>
    </div>
  );
}
