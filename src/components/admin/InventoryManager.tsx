"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setTrackStock,
  addInventoryMove,
  type ActionResult,
} from "@/app/admin/inventario/actions";
import type { InventoryMoveType, Product } from "@/lib/types";

export default function InventoryManager({
  products,
}: {
  products: Product[];
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

  const tracked = products.filter((p) => p.track_stock);
  const untracked = products.filter((p) => !p.track_stock);

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Con control de stock</h2>
        {tracked.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Ningún producto rastrea inventario todavía.
          </p>
        ) : (
          <div className="space-y-2">
            {tracked.map((p) => (
              <StockRow
                key={p.id}
                product={p}
                disabled={isPending}
                onMove={(type, qty, reason) =>
                  run(() => addInventoryMove(p.id, type, qty, reason))
                }
                onUntrack={() => run(() => setTrackStock(p.id, false))}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Sin control de stock</h2>
        {untracked.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Todos los productos rastrean inventario.
          </p>
        ) : (
          <div className="space-y-2">
            {untracked.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-black/10 p-3 dark:border-white/10"
              >
                <span className="text-sm">{p.name}</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => setTrackStock(p.id, true))}
                  className="rounded-full border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
                >
                  Activar rastreo
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StockRow({
  product,
  disabled,
  onMove,
  onUntrack,
}: {
  product: Product;
  disabled: boolean;
  onMove: (type: InventoryMoveType, qty: number, reason?: string) => void;
  onUntrack: () => void;
}) {
  const [qty, setQty] = useState("");
  const out = product.stock <= 0;
  const low = product.stock > 0 && product.stock <= 5;

  function submit(type: InventoryMoveType) {
    const n = Number(qty);
    if (!(n > 0)) return;
    onMove(type, n, type === "entrada" ? "reabastecimiento" : "ajuste");
    setQty("");
  }

  return (
    <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{product.name}</span>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              out
                ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
                : low
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                  : "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
            }`}
          >
            {product.stock} {out ? "· agotado" : low ? "· bajo" : ""}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={onUntrack}
            className="text-xs text-black/50 hover:underline dark:text-white/50"
          >
            Quitar rastreo
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min="1"
          step="1"
          placeholder="Cantidad"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-28 rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/15 dark:bg-transparent"
        />
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
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
        >
          − Salida
        </button>
      </div>
    </div>
  );
}
