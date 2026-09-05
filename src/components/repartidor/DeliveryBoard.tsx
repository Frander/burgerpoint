"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { markDelivered } from "@/app/repartidor/actions";
import { formatMoney, formatHora, inicioDelDia } from "@/lib/format";
import type { OrderWithItems } from "@/lib/types";

/** Ciudad del negocio: ayuda a que el mapa no mande a otro estado. */
const CIUDAD = "Ticul, Yucatán, México";

function mapsUrl(address: string): string {
  const q = encodeURIComponent(`${address}, ${CIUDAD}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function minutosDesde(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "recién";
  if (mins === 1) return "hace 1 min";
  if (mins < 60) return `hace ${mins} min`;
  return `hace ${Math.floor(mins / 60)} h`;
}

export default function DeliveryBoard({
  courierId,
  initialOrders,
}: {
  courierId: string;
  initialOrders: OrderWithItems[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tick, setTick] = useState(0);
  void tick;

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*, order_item_modifiers(*))")
      .eq("courier_id", courierId)
      .or(
        `status.eq.listo,and(status.eq.entregado,closed_at.gte.${inicioDelDia()})`,
      )
      .order("assigned_at", { ascending: true, nullsFirst: false });
    if (data) setOrders(data as OrderWithItems[]);
  }, [courierId]);

  // En la calle el celular se bloquea y la conexión se cae: además del canal
  // en vivo, se recarga al volver a la pantalla y cada minuto.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("entregas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => refetch(),
      )
      .subscribe();

    function onVisible() {
      if (document.visibilityState === "visible") refetch();
    }
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (document.visibilityState === "visible") refetch();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, [refetch]);

  function entregar(order: OrderWithItems) {
    const aviso =
      order.payment_status !== "pagado"
        ? `¿Ya entregaste el pedido ${order.code} y cobraste ${formatMoney(Number(order.total))}?`
        : `¿Confirmas que entregaste el pedido ${order.code}?`;
    if (!confirm(aviso)) return;

    setError(null);
    startTransition(async () => {
      const res = await markDelivered(order.id);
      if (!res.ok) setError(res.error ?? "No se pudo marcar como entregado.");
      await refetch();
    });
  }

  const pendientes = orders.filter((o) => o.status === "listo");
  const entregados = orders.filter((o) => o.status === "entregado");
  const porCobrar = pendientes
    .filter((o) => o.payment_status !== "pagado")
    .reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div className="mx-auto w-full max-w-lg">
      {error && (
        <p className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <h1 className="text-lg font-bold">
          Por entregar{" "}
          <span className="text-black/40 dark:text-white/40">
            ({pendientes.length})
          </span>
        </h1>
        {porCobrar > 0 && (
          <span className="text-sm font-medium text-orange-600">
            Por cobrar {formatMoney(porCobrar)}
          </span>
        )}
      </div>

      {pendientes.length === 0 && (
        <p className="rounded-2xl border border-dashed border-black/15 px-4 py-12 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
          No tienes entregas pendientes. 🎉
          <br />
          Aquí aparecerán en cuanto te asignen un pedido.
        </p>
      )}

      <div className="space-y-3">
        {pendientes.map((order) => {
          const abierta = abierto === order.id;
          const piezas = order.order_items.reduce((n, i) => n + i.quantity, 0);
          const pagado = order.payment_status === "pagado";
          return (
            <article
              key={order.id}
              className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[.03]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold">
                  {order.code}
                </span>
                <span className="text-xs text-black/40 dark:text-white/40">
                  {formatHora(order.assigned_at ?? order.created_at)} ·{" "}
                  {minutosDesde(order.assigned_at ?? order.created_at)}
                </span>
              </div>

              {/* Lo más importante de la tarjeta: a dónde va */}
              <p className="mt-2 text-lg font-semibold leading-snug">
                📍 {order.address || "Sin dirección"}
              </p>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                {order.customer_name}
              </p>
              {order.notes && (
                <p className="mt-1 text-sm italic text-black/60 dark:text-white/60">
                  Nota: {order.notes}
                </p>
              )}

              <div className="mt-3 flex gap-2">
                {order.address && (
                  <a
                    href={mapsUrl(order.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-xl bg-blue-600 px-3 py-3 text-center text-sm font-semibold text-white"
                  >
                    🗺 Cómo llegar
                  </a>
                )}
                {order.customer_phone && (
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="flex-1 rounded-xl border border-black/15 px-3 py-3 text-center text-sm font-semibold dark:border-white/15"
                  >
                    📞 Llamar
                  </a>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                <span className="text-base font-bold">
                  {formatMoney(Number(order.total))}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    pagado
                      ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                      : "bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200"
                  }`}
                >
                  {pagado ? "✓ Pagado" : "COBRAR"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setAbierto(abierta ? null : order.id)}
                className="mt-2 w-full text-left text-xs text-black/50 underline dark:text-white/50"
              >
                {abierta ? "Ocultar" : `Ver pedido (${piezas} art.)`}
              </button>
              {abierta && (
                <ul className="mt-2 space-y-1 text-sm">
                  {order.order_items.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium">{item.quantity}×</span>{" "}
                      {item.product_name}
                      {(item.order_item_modifiers ?? []).map((m) => (
                        <span
                          key={m.id}
                          className="block pl-5 text-xs text-black/50 dark:text-white/50"
                        >
                          + {m.modifier_name}
                        </span>
                      ))}
                      {item.notes && (
                        <span className="block pl-5 text-xs italic text-black/50 dark:text-white/50">
                          {item.notes}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                disabled={isPending}
                onClick={() => entregar(order)}
                className="mt-3 w-full rounded-xl bg-green-600 px-4 py-4 text-base font-bold text-white disabled:opacity-50"
              >
                ✓ Entregado
              </button>
            </article>
          );
        })}
      </div>

      {entregados.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Entregadas hoy ({entregados.length})
          </h2>
          <ul className="space-y-1">
            {entregados.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2 text-sm text-black/60 dark:border-white/10 dark:text-white/60"
              >
                <span className="truncate">
                  <span className="font-mono">{o.code}</span> · {o.address}
                </span>
                <span className="shrink-0 pl-2">
                  {o.closed_at ? formatHora(o.closed_at) : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
