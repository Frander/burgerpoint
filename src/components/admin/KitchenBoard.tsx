"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus } from "@/app/admin/pedidos/actions";
import { ORDER_STATUS_META, nextStatus } from "@/lib/orders";
import type { OrderStatus, OrderWithItems } from "@/lib/types";

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: "nuevo", title: "Nuevos" },
  { status: "en_cocina", title: "En cocina" },
  { status: "listo", title: "Listos" },
];

const ACTIVE: OrderStatus[] = ["nuevo", "en_cocina", "listo"];

function minutesAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (mins === 1) return "hace 1 min";
    return `hace ${mins} min`;
  } catch {
    return "";
  }
}

export default function KitchenBoard({
  initialOrders,
}: {
  initialOrders: OrderWithItems[];
}) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const [live, setLive] = useState(false);
  const [, startTransition] = useTransition();
  const [tick, setTick] = useState(0); // fuerza re-render de los tiempos

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("status", ACTIVE)
      .order("created_at", { ascending: true });
    if (data) setOrders(data as OrderWithItems[]);
  }, []);

  // Suscripción a cambios en la tabla orders.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("kds-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => refetch(),
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Refresca los "hace X min" cada 30s.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  void tick;

  function advance(order: OrderWithItems) {
    const next = nextStatus(order.status);
    if (!next) return;
    // Optimista: lo movemos/quitamos de inmediato.
    setOrders((prev) =>
      next === "entregado"
        ? prev.filter((o) => o.id !== order.id)
        : prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
    );
    startTransition(async () => {
      await updateOrderStatus(order.id, next);
      refetch();
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cocina</h1>
        <span
          className={`flex items-center gap-2 text-xs ${
            live ? "text-green-600" : "text-black/40 dark:text-white/40"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              live ? "bg-green-500" : "bg-black/30 dark:bg-white/30"
            }`}
          />
          {live ? "En vivo" : "Conectando…"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-black/60 dark:text-white/60">
                {col.title}
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs dark:bg-white/10">
                  {colOrders.length}
                </span>
              </h2>
              <div className="space-y-3">
                {colOrders.length === 0 && (
                  <p className="rounded-lg border border-dashed border-black/10 p-4 text-center text-xs text-black/40 dark:border-white/10 dark:text-white/40">
                    —
                  </p>
                )}
                {colOrders.map((order) => {
                  const next = nextStatus(order.status);
                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border border-black/10 bg-black/[.02] p-3 dark:border-white/10 dark:bg-white/[.02]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold">
                          {order.code}
                        </span>
                        <span className="text-xs text-black/40 dark:text-white/40">
                          {minutesAgo(order.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-black/50 dark:text-white/50">
                        {order.customer_name} ·{" "}
                        {order.type === "delivery" ? "Entrega" : "Recoger"}
                      </p>
                      <ul className="mt-2 space-y-0.5 text-sm">
                        {order.order_items.map((item) => (
                          <li key={item.id}>
                            <span className="font-medium">{item.quantity}×</span>{" "}
                            {item.product_name}
                            {item.notes && (
                              <span className="block pl-5 text-xs italic text-black/50 dark:text-white/50">
                                {item.notes}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {order.notes && (
                        <p className="mt-2 text-xs italic text-black/50 dark:text-white/50">
                          Nota: {order.notes}
                        </p>
                      )}
                      {next && (
                        <button
                          type="button"
                          onClick={() => advance(order)}
                          className="mt-3 w-full rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
                        >
                          {order.status === "listo"
                            ? "Marcar entregado"
                            : `Marcar ${ORDER_STATUS_META[next].label.toLowerCase()}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
