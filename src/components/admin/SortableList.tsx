"use client";

import { useRef, useState } from "react";

/**
 * Lista que se reordena arrastrando el asa (funciona con mouse y con el dedo,
 * para la tablet de la caja) o con las flechas ↑/↓ cuando el asa tiene el foco.
 *
 * El orden se lleva aquí en local (solo los ids) para que el movimiento se vea
 * al instante; cuando el servidor devuelve el orden ya guardado, se resincroniza.
 * Guardar solo ids evita que un dato recién editado en el servidor —un nombre,
 * por ejemplo— se muestre viejo mientras dura el arrastre.
 */
export default function SortableList<T extends { id: string }>({
  items,
  onReorder,
  disabled = false,
  className = "space-y-2",
  renderItem,
}: {
  items: T[];
  /** Recibe los ids en su nuevo orden, ya listos para guardar. */
  onReorder: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
  /** `handle` es el asa: colócala donde quieras dentro de la fila. */
  renderItem: (
    item: T,
    handle: React.ReactNode,
    dragging: boolean,
  ) => React.ReactNode;
}) {
  const serverIds = items.map((item) => item.id);
  const serverKey = serverIds.join(",");

  const [syncedKey, setSyncedKey] = useState(serverKey);
  const [orderIds, setOrderIds] = useState(serverIds);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // El servidor manda otro orden (o se agregó/borró algo): adoptarlo.
  if (syncedKey !== serverKey) {
    setSyncedKey(serverKey);
    setOrderIds(serverIds);
    setDraggingId(null);
  }

  const rows = useRef(new Map<string, HTMLLIElement | null>());
  const liveOrder = useRef<string[]>([]);
  const orderAtDragStart = useRef<string[]>([]);

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = orderIds
    .map((id) => byId.get(id))
    .filter((item): item is T => Boolean(item));

  function reinsert(order: string[], from: number, to: number): string[] {
    const next = order.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  /** Mueve una posición arriba/abajo y guarda (teclado y accesibilidad). */
  function nudge(id: string, delta: number) {
    if (disabled) return;
    const from = orderIds.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= orderIds.length) return;
    const next = reinsert(orderIds, from, to);
    liveOrder.current = next;
    setOrderIds(next);
    onReorder(next);
  }

  function onPointerDown(id: string, event: React.PointerEvent<HTMLElement>) {
    if (disabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // preventDefault corta la selección de texto, pero también el foco: lo
    // devolvemos a mano para que las flechas ↑/↓ sirvan tras hacer clic.
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    liveOrder.current = orderIds;
    orderAtDragStart.current = orderIds;
    setDraggingId(id);
  }

  function onPointerMove(id: string, event: React.PointerEvent<HTMLElement>) {
    if (draggingId !== id) return;
    const order = liveOrder.current;
    const from = order.indexOf(id);
    if (from < 0) return;

    // Primera fila cuyo centro queda por debajo del puntero: ahí se inserta.
    let to = order.length - 1;
    for (let i = 0; i < order.length; i++) {
      const row = rows.current.get(order[i]);
      if (!row) continue;
      const rect = row.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        to = i;
        break;
      }
    }
    if (to === from) return;

    const next = reinsert(order, from, to);
    liveOrder.current = next;
    setOrderIds(next);
  }

  function onPointerUp(id: string, event: React.PointerEvent<HTMLElement>) {
    if (draggingId !== id) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingId(null);
    const next = liveOrder.current;
    if (next.join(",") !== orderAtDragStart.current.join(",")) onReorder(next);
  }

  return (
    <ul className={className}>
      {ordered.map((item) => {
        const dragging = draggingId === item.id;
        const handle = (
          <button
            type="button"
            aria-label="Arrastrar para reordenar"
            title="Arrastra para reordenar (o enfoca y usa ↑ ↓)"
            disabled={disabled}
            onPointerDown={(event) => onPointerDown(item.id, event)}
            onPointerMove={(event) => onPointerMove(item.id, event)}
            onPointerUp={(event) => onPointerUp(item.id, event)}
            onPointerCancel={(event) => onPointerUp(item.id, event)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                nudge(item.id, -1);
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                nudge(item.id, 1);
              }
            }}
            className="shrink-0 cursor-grab touch-none select-none px-1 text-lg leading-none text-black/25 hover:text-black/60 active:cursor-grabbing disabled:cursor-default disabled:opacity-40 dark:text-white/25 dark:hover:text-white/60"
          >
            ⠿
          </button>
        );

        return (
          <li
            key={item.id}
            ref={(row) => {
              rows.current.set(item.id, row);
            }}
            className={
              dragging
                ? "relative z-10 rounded-lg opacity-90 shadow-lg ring-2 ring-black/20 dark:ring-white/25"
                : undefined
            }
          >
            {renderItem(item, handle, dragging)}
          </li>
        );
      })}
    </ul>
  );
}
