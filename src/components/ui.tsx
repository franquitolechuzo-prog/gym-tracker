import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { formatWeight, parseDecimal } from '../lib/format';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-neutral-950 active:bg-accent-strong',
  secondary: 'bg-neutral-800 text-neutral-100 active:bg-neutral-700',
  danger: 'bg-red-900/60 text-red-100 active:bg-red-800',
  ghost: 'bg-transparent text-neutral-300 active:bg-neutral-800',
};

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-neutral-300 active:bg-neutral-800 disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-400">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-neutral-500">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'h-12 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 text-base text-neutral-100 outline-none focus:border-accent';

/** On/off switch rendered as a large tappable row. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl bg-neutral-900 px-4 py-2 text-left"
    >
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-neutral-500">{description}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-neutral-700'}`}>
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  );
}

/** Segmented control for a small set of options. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-neutral-900 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-lg px-3 font-semibold ${value === o.value ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Numeric input with large −/+ buttons. Accepts comma or dot decimals.
 * Commits on blur/Enter and on each button press; an empty field commits `undefined` when `optional`.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  decimal = false,
  optional = false,
  suffix,
  compact = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  decimal?: boolean;
  optional?: boolean;
  suffix?: string;
  compact?: boolean;
}) {
  const id = useId();
  const show = (v: number | undefined) => (v === undefined ? '' : decimal ? formatWeight(v) : String(v));
  const [draft, setDraft] = useState(show(value));
  // Re-sync the text when the stored value changes elsewhere.
  useEffect(() => setDraft(show(value)), [value]);

  const clamp = (n: number) => {
    let v = decimal ? Math.round(n * 100) / 100 : Math.round(n);
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  const commit = () => {
    const parsed = parseDecimal(draft);
    if (parsed === null) {
      if (optional && draft.trim() === '') onChange(undefined);
      else setDraft(show(value));
      return;
    }
    const v = clamp(parsed);
    setDraft(show(v));
    if (v !== value) onChange(v);
  };

  const bump = (dir: 1 | -1) => {
    const current = parseDecimal(draft) ?? value ?? min ?? 0;
    const v = clamp(current + dir * step);
    setDraft(show(v));
    onChange(v);
  };

  const h = compact ? 'h-12' : 'h-14';
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-400">
        {label}
      </label>
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          aria-label={`Restar ${label.toLowerCase()}`}
          onClick={() => bump(-1)}
          className={`${h} w-12 shrink-0 rounded-xl bg-neutral-800 text-2xl font-bold active:bg-neutral-700`}
        >
          −
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type="text"
            inputMode={decimal ? 'decimal' : 'numeric'}
            enterKeyHint="done"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            onFocus={(e) => e.currentTarget.select()}
            className={`${h} w-full rounded-xl border border-neutral-800 bg-neutral-900 text-center text-lg font-semibold tabular-nums outline-none focus:border-accent ${suffix ? 'pr-8' : ''}`}
          />
          {suffix && (
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-neutral-500">{suffix}</span>
          )}
        </div>
        <button
          type="button"
          aria-label={`Sumar ${label.toLowerCase()}`}
          onClick={() => bump(1)}
          className={`${h} w-12 shrink-0 rounded-xl bg-neutral-800 text-2xl font-bold active:bg-neutral-700`}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Full-screen sheet on mobile, used for pickers. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-40 flex flex-col bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-900 px-2 pt-[env(safe-area-inset-top)]">
        <h2 className="px-2 py-4 text-xl font-bold">{title}</h2>
        <IconButton label="Cerrar" onClick={onClose}>
          <span aria-hidden className="text-2xl">✕</span>
        </IconButton>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="border-t border-neutral-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</div>}
    </div>
  );
}
