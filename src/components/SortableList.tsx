import { useEffect, useState, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripIcon } from './icons';

export interface DragHandleProps {
  ref: (el: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
}

/**
 * Vertical list reorderable by dragging a handle. Keeps the new order locally until the
 * persisted data (usually a live query) catches up, so rows don't jump back.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className = '',
}: {
  items: T[];
  onReorder: (ids: string[]) => void | Promise<void>;
  renderItem: (item: T, handle: ReactNode) => ReactNode;
  className?: string;
}) {
  const [pending, setPending] = useState<string[] | null>(null);
  const itemIds = items.map((i) => i.id);
  const key = itemIds.join('|');

  useEffect(() => {
    if (pending && pending.join('|') === key) setPending(null);
  }, [key, pending]);

  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = pending ? pending.map((id) => byId.get(id)).filter((x): x is T => !!x) : items;
  // If items were added/removed while pending, fall back to source order.
  const display = ordered.length === items.length ? ordered : items;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = display.map((i) => i.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setPending(next);
    void onReorder(next);
  };

  const position = (id: string | number | undefined) => display.findIndex((i) => i.id === id) + 1;
  const accessibility = {
    screenReaderInstructions: {
      draggable:
        'Para reordenar, presioná espacio o Enter para levantar el elemento, movelo con las flechas arriba y abajo, y presioná espacio o Enter para soltarlo. Escape cancela.',
    },
    announcements: {
      onDragStart: ({ active }: { active: { id: string | number } }) => `Elemento levantado, en la posición ${position(active.id)} de ${display.length}.`,
      onDragOver: ({ over }: { over: { id: string | number } | null }) => (over ? `Ahora en la posición ${position(over.id)} de ${display.length}.` : 'Fuera de la lista.'),
      onDragEnd: ({ over }: { over: { id: string | number } | null }) => (over ? `Elemento soltado en la posición ${position(over.id)}.` : 'Elemento soltado.'),
      onDragCancel: () => 'Reordenamiento cancelado.',
    },
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={accessibility}>
      <SortableContext items={display.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {display.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Arrastrar para reordenar"
      className="flex h-12 w-12 shrink-0 cursor-grab touch-none items-center justify-center text-neutral-500 active:text-neutral-200"
    >
      <GripIcon />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative bg-neutral-950 ${isDragging ? 'z-10 shadow-lg shadow-black ring-1 ring-neutral-700' : ''}`}
    >
      {children(handle)}
    </li>
  );
}
