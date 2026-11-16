import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { GroupedExercises, SearchBox } from './ExerciseList';
import { Button, Sheet } from './ui';
import { CheckIcon, PlusIcon } from './icons';

/**
 * Full-screen exercise chooser. Tapping a row calls `onPick`; `selectedIds` get a check mark.
 * With `multiple`, the sheet stays open until "Listo".
 */
export function ExercisePicker({
  title = 'Agregar ejercicio',
  onPick,
  onClose,
  selectedIds = [],
  multiple = false,
}: {
  title?: string;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
  selectedIds?: string[];
  multiple?: boolean;
}) {
  const [query, setQuery] = useState('');
  const exercises = useLiveQuery(() => db.exercises.filter((e) => !e.archived).toArray(), []);
  const selected = new Set(selectedIds);

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        multiple ? (
          <Button variant="primary" className="w-full" onClick={onClose}>
            Listo
          </Button>
        ) : undefined
      }
    >
      <SearchBox value={query} onChange={setQuery} id="picker-search" />
      {exercises && (
        <GroupedExercises
          exercises={exercises}
          query={query}
          renderRow={(e) => (
            <button
              type="button"
              onClick={() => {
                onPick(e.id);
                if (!multiple) onClose();
              }}
              className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-neutral-900"
            >
              <span className="flex-1">{e.name}</span>
              {selected.has(e.id) ? (
                <CheckIcon className="text-accent" aria-label="Agregado" />
              ) : (
                <PlusIcon className="text-neutral-500" />
              )}
            </button>
          )}
        />
      )}
    </Sheet>
  );
}
