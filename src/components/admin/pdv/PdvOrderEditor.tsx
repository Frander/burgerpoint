"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addItemsToOrder,
  createPdvOrder,
  getProductOptions,
} from "@/app/admin/pdv/actions";
import type { OrderLineInput } from "@/lib/order-insert";
import { formatMoney } from "@/lib/format";
import { ORDER_TYPE_META } from "@/lib/orders";
import type {
  MenuCategory,
  OrderType,
  Product,
  ProductWithModifiers,
  SalaWithMesas,
} from "@/lib/types";
import PdvProductOptions from "./PdvProductOptions";

interface EditorLine extends OrderLineInput {
  /** Clave local de la línea (para editar/quitar). */
  key: string;
  name: string;
  unitPrice: number;
}

let lineSeq = 0;

export default function PdvOrderEditor({
  type,
  menu,
  salas,
  onClose,
  onCreated,
  appendToOrder,
  initialMesaId,
}: {
  type: OrderType;
  menu: MenuCategory[];
  salas: SalaWithMesas[];
  onClose: () => void;
  onCreated: () => void;
  /** Si se pasa, agrega productos a este pedido en vez de crear uno nuevo. */
  appendToOrder?: { id: string; code: string };
  initialMesaId?: string;
}) {
  const [lines, setLines] = useState<EditorLine[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(
    menu[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [mesaId, setMesaId] = useState(initialMesaId ?? "");
  const [notes, setNotes] = useState("");
  const [optionsFor, setOptionsFor] = useState<ProductWithModifiers | null>(null);
  const [loadingOptions, setLoadingOptions] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const products = useMemo(() => {
    const all = search.trim()
      ? menu.flatMap((c) => c.products)
      : (menu.find((c) => c.id === activeCategory)?.products ?? []);
    const q = search.trim().toLowerCase();
    return q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
  }, [menu, activeCategory, search]);

  const itemsTotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const fee = type === "delivery" ? Number(deliveryFee) || 0 : 0;
  const total = itemsTotal + fee;

  function addSimple(product: Product) {
    setLines((prev) => {
      // Sin opciones ni notas: agrupa en la misma línea.
      const existing = prev.find(
        (l) => l.productId === product.id && !l.modifiers?.length && !l.notes,
      );
      if (existing) {
        return prev.map((l) =>
          l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key: `l${lineSeq++}`,
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
        },
      ];
    });
  }

  function pickProduct(product: Product) {
    setError(null);
    if (!product.has_modifiers) {
      addSimple(product);
      return;
    }
    setLoadingOptions(product.id);
    getProductOptions(product.id)
      .then((full) => {
        if (full && full.modifier_groups.length > 0) setOptionsFor(full);
        else addSimple(product);
      })
      .finally(() => setLoadingOptions(null));
  }

  function changeQty(key: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + delta } : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  function submit() {
    setError(null);
    if (lines.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }
    const items = lines.map(({ productId, quantity, notes: n, modifiers }) => ({
      productId,
      quantity,
      notes: n,
      modifiers,
    }));

    if (appendToOrder) {
      startTransition(async () => {
        const res = await addItemsToOrder(appendToOrder.id, items);
        if (!res.ok) setError(res.error ?? "Error al agregar productos.");
        else onCreated();
      });
      return;
    }

    if (type === "delivery" && !address.trim()) {
      setError("Falta la dirección de entrega.");
      return;
    }
    if (type === "en_mesa" && !mesaId) {
      setError("Elige una mesa.");
      return;
    }
    startTransition(async () => {
      const res = await createPdvOrder({
        type,
        items,
        customer_name: customerName,
        customer_phone: customerPhone,
        address,
        notes,
        delivery_fee: fee,
        mesa_id: mesaId || undefined,
      });
      if (!res.ok) setError(res.error ?? "Error al crear el pedido.");
      else onCreated();
    });
  }

  const meta = ORDER_TYPE_META[type];

  return (
    <div className="fixed inset-0 z-30 flex bg-black/40">
      <div className="m-auto flex h-[92vh] w-[min(1200px,96vw)] overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl">
        {/* Izquierda: catálogo */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-gray-100">
          <div className="flex items-center gap-3 border-b border-gray-100 p-4">
            <h2 className="text-lg font-bold">
              {appendToOrder
                ? `➕ Agregar productos — ${appendToOrder.code}`
                : `${meta.icon} Nuevo pedido — ${meta.label}`}
            </h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto…"
              className="ml-auto w-56 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-gray-900 focus:bg-white focus:outline-none"
            />
          </div>

          {!search && (
            <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-4 py-2">
              {menu.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                    activeCategory === cat.id
                      ? "bg-gray-900 font-medium text-white"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={loadingOptions === p.id}
                onClick={() => pickProduct(p)}
                className="flex flex-col items-start rounded-xl border border-gray-200 p-3 text-left transition-colors hover:border-gray-900 disabled:opacity-50"
              >
                <span className="line-clamp-2 text-sm font-medium">
                  {loadingOptions === p.id ? "Cargando…" : p.name}
                </span>
                <span className="mt-1 text-xs text-gray-500">
                  {formatMoney(p.price)}
                  {p.has_modifiers ? " · opciones" : ""}
                </span>
              </button>
            ))}
            {products.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-gray-400">
                Sin productos.
              </p>
            )}
          </div>
        </div>

        {/* Derecha: ticket */}
        <div className="flex w-[380px] shrink-0 flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <h3 className="font-semibold">Ticket</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-2 text-xl text-gray-400 hover:text-gray-900"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {lines.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                Toca productos para agregarlos.
              </p>
            )}
            {lines.map((line) => (
              <div
                key={line.key}
                className="rounded-lg border border-gray-100 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {line.name}
                  </span>
                  <span className="text-sm">
                    {formatMoney(line.unitPrice * line.quantity)}
                  </span>
                </div>
                {(line.modifiers ?? []).map((m, i) => (
                  <span key={i} className="block pl-2 text-xs text-gray-500">
                    +1 {m.name}
                    {m.extra_price > 0 ? ` (${formatMoney(m.extra_price)})` : ""}
                  </span>
                ))}
                {line.notes && (
                  <span className="block pl-2 text-xs italic text-gray-500">
                    {line.notes}
                  </span>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changeQty(line.key, -1)}
                    className="h-7 w-7 rounded border border-gray-200 text-sm hover:bg-gray-50"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => changeQty(line.key, 1)}
                    className="h-7 w-7 rounded border border-gray-200 text-sm hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Datos del pedido */}
          <div className="space-y-2 border-t border-gray-100 p-4">
            {!appendToOrder && type === "en_mesa" && (
              <select
                value={mesaId}
                onChange={(e) => setMesaId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-gray-900 focus:bg-white focus:outline-none"
              >
                <option value="">Elegir mesa…</option>
                {salas.map((sala) => (
                  <optgroup key={sala.id} label={sala.name}>
                    {sala.mesas.map((mesa) => (
                      <option key={mesa.id} value={mesa.id}>
                        {mesa.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            {!appendToOrder && (
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={
                  type === "delivery"
                    ? "Nombre del cliente *"
                    : "Cliente (opcional)"
                }
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-gray-900 focus:bg-white focus:outline-none"
              />
            )}
            {!appendToOrder && (type === "delivery" || type === "pickup") && (
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Teléfono (opcional)"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-gray-900 focus:bg-white focus:outline-none"
              />
            )}
            {!appendToOrder && type === "delivery" && (
              <>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Dirección de entrega *"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-gray-900 focus:bg-white focus:outline-none"
                />
                <input
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Precio de entrega (MXN)"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-gray-900 focus:bg-white focus:outline-none"
                />
              </>
            )}
            {!appendToOrder && (
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nota del pedido (opcional)"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-gray-900 focus:bg-white focus:outline-none"
              />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between pt-1 text-sm">
              <span className="text-gray-500">
                Subtotal {formatMoney(itemsTotal)}
                {fee > 0 ? ` + envío ${formatMoney(fee)}` : ""}
              </span>
              <span className="text-lg font-bold">{formatMoney(total)}</span>
            </div>
            <button
              type="button"
              disabled={isPending || lines.length === 0}
              onClick={submit}
              className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isPending
                ? "Guardando…"
                : appendToOrder
                  ? "Agregar al pedido"
                  : "Enviar a cocina"}
            </button>
          </div>
        </div>
      </div>

      {/* Selector de opciones para productos con modificadores */}
      {optionsFor && (
        <PdvProductOptions
          product={optionsFor}
          onClose={() => setOptionsFor(null)}
          onAdd={(line) => {
            setLines((prev) => [
              ...prev,
              { ...line, key: `l${lineSeq++}` },
            ]);
            setOptionsFor(null);
          }}
        />
      )}
    </div>
  );
}
