"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMeatMove,
  setProductMeat,
  type ActionResult,
} from "@/app/admin/inventario/actions";
import type {
  Category,
  InventoryMoveType,
  Meat,
  MeatDailyMove,
  MeatEntry,
  Product,
  ProductMeat,
} from "@/lib/types";

/** Con estas porciones o menos se avisa que hay que resurtir. */
const POCAS = 10;
const PORCIONES = [0, 1, 2, 3, 4];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-10-04" → "4 oct". */
function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

/**
 * Inventario → Carnes e ingredientes (res, cerdo, salchicha, queso cheddar).
 * Se cuenta en porciones: se captura la entrada ("100 de res el 4 oct") y cada
 * venta descuenta lo que lleva el producto (trigger de la migración 0018). Un
 * producto puede llevar ninguno, uno o varios (0019). No bloquea ventas: solo
 * lleva la cuenta.
 */
export default function MeatManager({
  meats,
  productMeats,
  entradas,
  historial,
  products,
  categories,
  hoy,
}: {
  meats: Meat[];
  productMeats: ProductMeat[];
  /** Últimas entradas de todas las carnes, las más recientes primero. */
  entradas: MeatEntry[];
  /** Movimientos sumados por día, los más recientes primero. */
  historial: MeatDailyMove[];
  products: Product[];
  categories: Category[];
  /** "2026-10-04", hoy en Yucatán. */
  hoy: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  // Porciones de cada ingrediente por producto: producto → (ingrediente → n).
  const porProducto = new Map<string, Map<string, number>>();
  for (const pm of productMeats) {
    const delProducto = porProducto.get(pm.product_id) ?? new Map<string, number>();
    delProducto.set(pm.meat_id, pm.portions);
    porProducto.set(pm.product_id, delProducto);
  }
  const nombreCarne = (id: string) => meats.find((m) => m.id === id)?.name ?? "Ingrediente";

  // Productos por categoría, en el orden del menú; los sueltos al final.
  const grupos = [
    ...categories.map((c) => ({
      id: c.id,
      name: c.name,
      products: products.filter((p) => p.category_id === c.id),
    })),
    {
      id: "sin-categoria",
      name: "Sin categoría",
      products: products.filter((p) => !categories.some((c) => c.id === p.category_id)),
    },
  ].filter((g) => g.products.length > 0);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold">Carnes e ingredientes</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Por porciones. Captura lo que entra y cada venta descuenta sola lo que
          lleva el producto. Si la cuenta llega a 0 se sigue vendiendo.
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {meats.map((meat) => (
            <MeatCard
              key={meat.id}
              meat={meat}
              ultima={entradas.find((e) => e.meat_id === meat.id) ?? null}
              hoy={hoy}
              disabled={isPending}
              onMove={(type, quantity, date) =>
                run(() => addMeatMove({ meatId: meat.id, type, quantity, date }))
              }
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Qué lleva cada producto</h3>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Un producto puede llevar varios a la vez (por ejemplo res, cheddar y
          salchicha) o ninguno. Aplica a las ventas de aquí en adelante; lo ya
          vendido no se recalcula.
        </p>

        <div className="mt-3 space-y-2">
          {grupos.map((g) => {
            const conCarne = g.products.filter((p) => porProducto.has(p.id)).length;
            return (
              <details
                key={g.id}
                className="rounded-lg border border-black/10 dark:border-white/10"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium">
                  <span>{g.name}</span>
                  <span className="text-xs font-normal text-black/50 dark:text-white/50">
                    {conCarne === 0
                      ? "sin configurar"
                      : `${conCarne} de ${g.products.length} configurados`}
                  </span>
                </summary>

                <div className="border-t border-black/10 px-3 py-2 dark:border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-black/[.03] px-2 py-2 text-xs dark:bg-white/5">
                    <span className="text-black/60 dark:text-white/60">Toda la categoría:</span>
                    <CategoryPicker
                      meats={meats}
                      disabled={isPending}
                      onApply={(meatId, portions) =>
                        run(() =>
                          setProductMeat(
                            g.products.map((p) => p.id),
                            meatId,
                            portions,
                          ),
                        )
                      }
                    />
                  </div>

                  <div className="mt-1 divide-y divide-black/5 dark:divide-white/5">
                    {g.products.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                      >
                        <span>{p.name}</span>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          {meats.map((m) => (
                            <label
                              key={m.id}
                              className="flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60"
                            >
                              {m.name}
                              <PortionSelect
                                value={porProducto.get(p.id)?.get(m.id) ?? 0}
                                disabled={isPending}
                                label={`${p.name}: porciones de ${m.name}`}
                                onChange={(n) => run(() => setProductMeat([p.id], m.id, n))}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Movimientos</h3>
        {historial.length === 0 ? (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">
            Todavía no hay movimientos. Empieza capturando una entrada.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-black/5 rounded-lg border border-black/10 text-sm dark:divide-white/5 dark:border-white/10">
            {historial.map((h) => {
              const entrada = h.type === "entrada";
              return (
                <div
                  key={`${h.moved_on}-${h.meat_id}-${h.type}-${h.reason}`}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="w-16 shrink-0 text-black/60 dark:text-white/60">
                    {fechaCorta(h.moved_on)}
                  </span>
                  <span className="flex-1">
                    {nombreCarne(h.meat_id)} ·{" "}
                    {entrada ? "Entrada" : h.reason === "venta" ? "Ventas del día" : "Merma / ajuste"}
                  </span>
                  <span
                    className={`font-medium tabular-nums ${
                      entrada ? "text-green-700 dark:text-green-400" : ""
                    }`}
                  >
                    {entrada ? "+" : "−"}
                    {h.quantity}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MeatCard({
  meat,
  ultima,
  hoy,
  disabled,
  onMove,
}: {
  meat: Meat;
  /** La entrada más reciente de este ingrediente. */
  ultima: MeatEntry | null;
  hoy: string;
  disabled: boolean;
  onMove: (type: InventoryMoveType, quantity: number, date: string) => void;
}) {
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(hoy);

  const out = meat.stock <= 0;
  const low = meat.stock > 0 && meat.stock <= POCAS;

  // "Entraron 100 el 4 oct; desde entonces salieron 80": lo que había justo
  // después de esa entrada menos lo que queda (ventas y mermas).
  const usadas = ultima?.stock_after != null ? ultima.stock_after - meat.stock : null;

  function submit(type: InventoryMoveType) {
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) return;
    onMove(type, n, date || hoy);
    setQty("");
    setDate(hoy);
  }

  return (
    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{meat.name}</h3>
        {(out || low) && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              out
                ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
            }`}
          >
            {out ? "Sin porciones" : "Quedan pocas"}
          </span>
        )}
      </div>

      <p className="mt-2 text-4xl font-bold tabular-nums">{meat.stock}</p>
      <p className="text-sm text-black/60 dark:text-white/60">
        {meat.stock === 1 ? "porción queda" : "porciones quedan"}
      </p>

      <p className="mt-2 text-xs text-black/60 dark:text-white/60">
        {ultima
          ? `Última entrada: ${ultima.quantity} el ${fechaCorta(ultima.moved_on)}.` +
            (usadas != null ? ` Desde entonces salieron ${usadas}.` : "")
          : "Sin entradas todavía."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          placeholder="Porciones"
          aria-label={`${meat.name}: porciones`}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-28 rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <input
          type="date"
          max={hoy}
          aria-label={`${meat.name}: fecha`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-transparent"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || !qty}
          onClick={() => submit("entrada")}
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          + Entrada
        </button>
        <button
          type="button"
          disabled={disabled || !qty}
          onClick={() => submit("salida")}
          title="Lo que se echó a perder o para corregir el conteo"
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
        >
          − Merma / ajuste
        </button>
      </div>
    </div>
  );
}

const CLASE_SELECT =
  "rounded-md border border-black/15 px-2 py-1.5 text-sm disabled:opacity-50 dark:border-white/15 dark:bg-transparent";

/** Porciones de un ingrediente; 0 = no lo lleva. */
function PortionSelect({
  value,
  disabled,
  label,
  onChange,
}: {
  value: number;
  disabled: boolean;
  label: string;
  onChange: (portions: number) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${CLASE_SELECT} ${value > 0 ? "font-semibold text-black dark:text-white" : ""}`}
    >
      {/* Por si en la base hay un valor fuera de la lista. */}
      {[...new Set([...PORCIONES, value])].sort((a, b) => a - b).map((n) => (
        <option key={n} value={n}>
          {n === 0 ? "—" : n}
        </option>
      ))}
    </select>
  );
}

/**
 * Fila de "toda la categoría": ingrediente + porciones. Espera al botón porque
 * pisa muchos productos; solo toca el ingrediente elegido, los demás se quedan.
 */
function CategoryPicker({
  meats,
  disabled,
  onApply,
}: {
  meats: Meat[];
  disabled: boolean;
  onApply: (meatId: string, portions: number) => void;
}) {
  const [meatId, setMeatId] = useState("");
  const [portions, setPortions] = useState(1);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={meatId}
        disabled={disabled}
        aria-label="Ingrediente"
        onChange={(e) => setMeatId(e.target.value)}
        className={CLASE_SELECT}
      >
        <option value="">Elige…</option>
        {meats.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <select
        value={portions}
        disabled={disabled}
        aria-label="Porciones"
        onChange={(e) => setPortions(Number(e.target.value))}
        className={CLASE_SELECT}
      >
        {PORCIONES.map((n) => (
          <option key={n} value={n}>
            {n === 0 ? "Quitar" : `${n} ${n === 1 ? "porción" : "porciones"}`}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled || !meatId}
        onClick={() => onApply(meatId, portions)}
        className="rounded-md border border-black/15 px-2.5 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
      >
        Aplicar
      </button>
    </div>
  );
}
