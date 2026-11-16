import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from './ui';
import { useDialogFocus } from './useDialogFocus';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Provides a promise-based confirmation dialog: `if (await confirm({...})) ...`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = undefined;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <ConfirmDialog opts={opts} onResult={close} />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ opts, onResult }: { opts: ConfirmOptions; onResult: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Focus lands on "Cancelar" first: the safe choice for destructive actions. Escape cancels.
  useDialogFocus(ref, () => onResult(false));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => onResult(false)}>
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={opts.message ? 'confirm-message' : undefined}
        className="w-full max-w-md rounded-2xl bg-neutral-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-bold">
          {opts.title}
        </h2>
        {opts.message && (
          <div id="confirm-message" className="mt-2 text-neutral-400">
            {opts.message}
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button onClick={() => onResult(false)}>{opts.cancelLabel ?? 'Cancelar'}</Button>
          <Button variant={opts.danger ? 'danger' : 'primary'} onClick={() => onResult(true)}>
            {opts.confirmLabel ?? 'Aceptar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
