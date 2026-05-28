"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/admin/pedidos/actions";
import { formatMoney } from "@/lib/format";
import { ORDER_STATUS_META, nextStatus } from "@/lib/orders";
import type { OrderStatus, OrderWithItems } from "@/lib/types";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function OrderList({ orders }: { orders: OrderWithItems[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeStatus(id: string, status: OrderStatus) {
    setError(null);
    startTransition(async () => {
      const res = await updateOrderStatus(id, status);
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-black/60 dark:border-white/15 dark:text-white/60">
        Aún no hay pedidos.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {orders.map((order) => {
        const meta = ORDER_STATUS_META[order.status];
        const next = nextStatus(order.status);
        return (
          <div
            key={order.id}
            className="rounded-xl border border-black/10 p-4 dark:border-white/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-sm font-semibold">
                  {order.code}
                </span>
                <span className="ml-2 text-sm text-black/60 dark:text-white/60">
                  {order.customer_name} ·{" "}
                  {order.type === "delivery" ? "Entrega" : "Recoger"}
                </span>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}
              >
                {meta.label}
              </span>
            </div>

            <p className="mt-1 text-xs text-black/40 dark:text-white/40">
              {formatTime(order.created_at)}
              {order.type === "delivery" && order.address
                ? ` · ${order.address}`
                : ""}
            </p>

            <ul className="mt-3 space-y-0.5 text-sm">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>
                    {item.quantity}× {item.product_name}
                  </span>
                  <span className="text-black/50 dark:text-white/50">
                    {formatMoney(item.unit_price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {order.notes && (
              <p className="mt-2 text-xs italic text-black/50 dark:text-white/50">
                Nota: {order.notes}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 dark:border-white/10">
              <span className="font-semibold">{formatMoney(order.total)}</span>
              <div className="flex gap-2">
                {next && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => changeStatus(order.id, next)}
                    className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    Marcar {ORDER_STATUS_META[next].label.toLowerCase()}
                  </button>
                )}
                {order.status !== "cancelado" &&
                  order.status !== "entregado" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        if (confirm(`¿Cancelar el pedido ${order.code}?`))
                          changeStatus(order.id, "cancelado");
                      }}
                      className="rounded-full border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
                    >
                      Cancelar
                    </button>
                  )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
