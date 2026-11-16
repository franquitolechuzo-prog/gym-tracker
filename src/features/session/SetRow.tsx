import { useState } from 'react';
import { Button, NumberStepper } from '../../components/ui';
import { CheckIcon } from '../../components/icons';
import type { Exercise, SetEntry } from '../../db/types';
import { removeSet, updateSet } from '../../db/sessions';
import { formatSet, type Comparison, type PRKind } from '../../lib/progress';

export function SetRow({
  set,
  exercise,
  previous,
  comparison,
  prs,
  weightStep,
  onToggleDone,
}: {
  set: SetEntry;
  exercise: Exercise;
  previous?: SetEntry;
  comparison?: Comparison;
  prs: PRKind[];
  weightStep: number;
  onToggleDone: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const label = set.isWarmup ? 'C' : String(set.setNumber);
  const name = `serie ${set.setNumber}`;

  return (
    <li className={`px-3 py-2 ${set.done ? 'bg-lime-950/40' : ''}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          aria-label={`Opciones de la ${name}${set.isWarmup ? ' (calentamiento)' : ''}`}
          className={`h-12 w-12 shrink-0 rounded-xl text-lg font-bold ${
            set.isWarmup ? 'bg-amber-900/60 text-amber-200' : 'bg-neutral-800 text-neutral-200'
          }`}
        >
          {label}
        </button>
        <div className="min-w-0 flex-1 text-sm leading-tight">
          <div className="truncate text-neutral-400">
            {previous ? `Anterior: ${formatSet(previous.weight, previous.reps, exercise.unit, exercise.isBodyweight)}` : 'Sin registro anterior'}
          </div>
          <div className="flex flex-wrap gap-x-2 font-semibold">
            {comparison === 'better' && <span className="text-accent">▲ Superaste la anterior</span>}
            {comparison === 'equal' && set.done && <span className="text-neutral-500">= Igual que la anterior</span>}
            {prs.length > 0 && <span className="text-amber-300">🏆 Récord</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleDone}
          aria-pressed={!!set.done}
          aria-label={set.done ? `Desmarcar ${name}` : `Marcar ${name} como hecha`}
          className={`flex h-12 w-14 shrink-0 items-center justify-center rounded-xl ${
            set.done ? 'bg-accent text-neutral-950' : 'border-2 border-neutral-700 text-neutral-500'
          }`}
        >
          <CheckIcon strokeWidth={3} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <NumberStepper
          compact
          hideLabel
          decimal
          label={`${exercise.isBodyweight ? 'Lastre' : 'Peso'} ${name}`}
          step={weightStep}
          min={exercise.isBodyweight ? undefined : 0}
          value={set.weight}
          onChange={(v) => updateSet(set.id, { weight: v ?? 0 })}
        />
        <NumberStepper
          compact
          hideLabel
          label={`Reps ${name}`}
          min={0}
          max={999}
          value={set.reps}
          onChange={(v) => updateSet(set.id, { reps: v ?? 0 })}
        />
      </div>
      {menu && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button
            onClick={() => {
              void updateSet(set.id, { isWarmup: !set.isWarmup });
              setMenu(false);
            }}
          >
            {set.isWarmup ? 'Es efectiva' : 'Calentamiento'}
          </Button>
          <Button variant="danger" onClick={() => removeSet(set.id)}>
            Eliminar serie
          </Button>
        </div>
      )}
    </li>
  );
}
