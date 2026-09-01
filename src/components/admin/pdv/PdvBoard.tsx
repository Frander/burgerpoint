"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus } from "@/app/admin/pedidos/actions";
import { cancelOrder, finalizeOrder } from "@/app/admin/pdv/actions";
import { formatMoney } from "@/lib/format";
import {
  ORDER_STATUS_META,
  ORDER_TYPE_META,
  nextStatus,
  orderStatusLabel,
} from "@/lib/orders";
import type {
  MenuCategory,
  OrderFull,
  OrderType,
  SalaWithMesas,
} from "@/lib/types";
import PdvOrderEditor from "./PdvOrderEditor";
import PdvPaymentModal from "./PdvPaymentModal";

type Tab = "mostrador" | "domicilio" | "mesas";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "mostrador", label: "Mostrador", icon: "🧾" },
  { id: "domicilio", label: "A domicilio", icon: "🛵" },
  { id: "mesas", label: "Mesas", icon: "🪑" },
];

const ACTIVE_STATUSES = ["nuevo", "en_cocina", "listo"] as const;

function tabOf(order: OrderFull): Tab {
  if (order.type === "delivery") return "domicilio";
  if (order.type === "en_mesa") return "mesas";
  return "mostrador";
}

function minutesAgo(iso: string): string {
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "ahora";
    return `${mins} min`;
  } catch {
    return "";
  }
}

export default function PdvBoard({
  menu,
  salas,
  initialOrders,
}: {
  menu: MenuCategory[];
  salas: SalaWithMesas[];
  initialOrders: OrderFull[];
}) {
  const [orders, setOrders] = useState<OrderFull[]>(initialOrders);
  const [tab, setTab] = useState<Tab>("mostrador");
  const [live, setLive] = useState(false);
  const [newOrderType, setNewOrderType] = useState<OrderType | null>(null);
  const [newOrderMesaId, setNewOrderMesaId] = useState<string | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [payingOrder, setPayingOrder] = useState<OrderFull | null>(null);
  const [appendOrder, setAppendOrder] = useState<OrderFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tick, setTick] = useState(0); // re-render de tiempos
  void tick;

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*, order_item_modifiers(*)), order_payments(*)")
      .in("status", [...ACTIVE_STATUSES])
      .order("created_at", { ascending: true });
    if (data) setOrders(data as OrderFull[]);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pdv-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => refetch(),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "Error");
      await refetch();
    });
  }

  const tabOrders = orders.filter((o) => tabOf(o) === tab);
  const counts = new Map<Tab, number>();
  for (const o of orders) counts.set(tabOf(o), (counts.get(tabOf(o)) ?? 0) + 1);
  const tabTotal = tabOrders.reduce((sum, o) => sum + Number(o.total), 0);

  // Atajos de teclado como OlaClick: Alt+N local, Alt+R llevar, Alt+Y domicilio.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || newOrderType) return;
      const key = e.key.toLowerCase();
      if (key === "n") setNewOrderType("en_local");
      else if (key === "r") setNewOrderType("pickup");
      else if (key === "y") setNewOrderType("delivery");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newOrderType]);

  return (
    <div>
      {/* Encabezado: pestañas + nuevo pedido */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-black/10 p-1 dark:border-white/10">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  tab === t.id
                    ? "bg-white/20 dark:bg-black/20"
                    : "bg-black/10 dark:bg-white/10"
                }`}
              >
                {counts.get(t.id) ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1.5 text-xs ${
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

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNewMenu((v) => !v)}
              className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black"
            >
              + Nuevo pedido ▾
            </button>
            {showNewMenu && (
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-neutral-900">
                {(
                  [
                    ["en_local", "Alt+N"],
                    ["pickup", "Alt+R"],
                    ["delivery", "Alt+Y"],
                    ["en_mesa", ""],
                  ] as [OrderType, string][]
                ).map(([type, shortcut]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setShowNewMenu(false);
                      setNewOrderType(type);
                    }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <span>
                      {ORDER_TYPE_META[type].icon} {ORDER_TYPE_META[type].label}
                    </span>
                    {shortcut && (
                      <span className="text-xs text-black/40 dark:text-white/40">
                        {shortcut}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 text-right text-sm text-black/60 dark:text-white/60">
        Total abierto: <span className="font-semibold">{formatMoney(tabTotal)}</span>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Cuadrícula de mesas: libre → nuevo pedido, ocupada → resumen */}
      {tab === "mesas" && (
        <div className="mt-4 space-y-4">
          {salas.length === 0 && (
            <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
              No hay salas configuradas.{" "}
              <a href="/admin/mesas" className="underline">
                Crear salas y mesas
              </a>
            </p>
          )}
          {salas.map((sala) => (
            <div key={sala.id}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/60 dark:text-white/60">
                {sala.name}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {sala.mesas.map((mesa) => {
                  const open = orders.find(
                    (o) => o.mesa_id === mesa.id && tabOf(o) === "mesas",
                  );
                  return (
                    <button
                      key={mesa.id}
                      type="button"
                      onClick={() => {
                        if (open) setAppendOrder(open);
                        else {
                          setNewOrderMesaId(mesa.id);
                          setNewOrderType("en_mesa");
                        }
                      }}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        open
                          ? "border-orange-300 bg-orange-50 hover:border-orange-500 dark:border-orange-500/40 dark:bg-orange-500/10"
                          : "border-black/10 hover:border-black/40 dark:border-white/10 dark:hover:border-white/40"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {mesa.name}
                      </span>
                      {open ? (
                        <span className="mt-1 block text-xs text-orange-700 dark:text-orange-300">
                          {formatMoney(Number(open.total))} ·{" "}
                          {minutesAgo(open.created_at)}
                        </span>
                      ) : (
                        <span className="mt-1 block text-xs text-black/40 dark:text-white/40">
                          Libre
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de pedidos abiertos de la pestaña */}
      <div className="mt-4 space-y-3">
        {tabOrders.length === 0 && (
          <p className="rounded-xl border border-dashed border-black/15 p-10 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
            No hay pedidos abiertos en {TABS.find((t) => t.id === tab)?.label}.
          </p>
        )}
        {tabOrders.map((order) => {
          const meta = ORDER_STATUS_META[order.status];
          const next = nextStatus(order.status);
          const paid = order.order_payments.reduce(
            (sum, p) => sum + Number(p.amount),
            0,
          );
          const mesaName =
            order.type === "en_mesa"
              ? salas
                  .flatMap((s) => s.mesas)
                  .find((m) => m.id === order.mesa_id)?.name
              : null;
          return (
            <div
              key={order.id}
              className="rounded-xl border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">
                    {order.code}
                  </span>
                  <span className="text-sm">
                    {ORDER_TYPE_META[order.type].icon}{" "}
                    {ORDER_TYPE_META[order.type].label}
                    {mesaName ? ` · ${mesaName}` : ""}
                  </span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs uppercase dark:bg-white/10">
                    {order.origin}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}
                  >
                    {orderStatusLabel(order.status, order.type)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      order.payment_status === "pagado"
                        ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                        : "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300"
                    }`}
                  >
                    {order.payment_status === "pagado" ? "Pagado" : "No pagado"}
                  </span>
                </div>
              </div>

              <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                {order.customer_name}
                {order.customer_phone ? ` · ${order.customer_phone}` : ""}
                {order.type === "delivery" && order.address
                  ? ` · ${order.address}`
                  : ""}
                {" · hace "}
                {minutesAgo(order.created_at)}
                {order.served_by ? ` · Atendió: ${order.served_by}` : ""}
              </p>

              <ul className="mt-2 space-y-0.5 text-sm">
                {order.order_items.map((item) => (
                  <li key={item.id}>
                    <div className="flex justify-between">
                      <span>
                        {item.quantity}× {item.product_name}
                      </span>
                      <span className="text-black/50 dark:text-white/50">
                        {formatMoney(item.unit_price * item.quantity)}
                      </span>
                    </div>
                    {(item.order_item_modifiers ?? []).map((m) => (
                      <span
                        key={m.id}
                        className="block pl-5 text-xs text-black/50 dark:text-white/50"
                      >
                        +1 {m.modifier_name}
                        {m.extra_price > 0
                          ? ` (${formatMoney(m.extra_price)})`
                          : ""}
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

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                <div className="text-sm">
                  <span className="font-semibold">{formatMoney(order.total)}</span>
                  {order.delivery_fee > 0 && (
                    <span className="ml-2 text-xs text-black/50 dark:text-white/50">
                      (incluye envío {formatMoney(order.delivery_fee)})
                    </span>
                  )}
                  {paid > 0 && paid < Number(order.total) && (
                    <span className="ml-2 text-xs text-orange-600">
                      Pagado {formatMoney(paid)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    title="Imprimir ticket del cliente"
                    onClick={() =>
                      window.open(
                        `/print/ticket/${order.id}?tipo=cliente`,
                        "_blank",
                        "width=420,height=720",
                      )
                    }
                    className="rounded-full border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
                  >
                    🖨 Ticket
                  </button>
                  <button
                    type="button"
                    title="Imprimir comanda de cocina"
                    onClick={() =>
                      window.open(
                        `/print/ticket/${order.id}?tipo=cocina`,
                        "_blank",
                        "width=420,height=720",
                      )
                    }
                    className="rounded-full border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
                  >
                    🖨 Comanda
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setAppendOrder(order)}
                    className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-white/15"
                  >
                    + Productos
                  </button>
                  {next && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => updateOrderStatus(order.id, next))}
                      className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-white/15"
                    >
                      → {orderStatusLabel(next, order.type)}
                    </button>
                  )}
                  {order.payment_status !== "pagado" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setPayingOrder(order)}
                      className="rounded-full border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-600 disabled:opacity-50"
                    >
                      $ Pago
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (
                        order.payment_status !== "pagado" &&
                        !confirm(
                          `El pedido ${order.code} NO está pagado. ¿Finalizar de todas formas?`,
                        )
                      )
                        return;
                      run(() => finalizeOrder(order.id));
                    }}
                    className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    ✓ Finalizar
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (confirm(`¿Cancelar el pedido ${order.code}?`))
                        run(() => cancelOrder(order.id));
                    }}
                    className="rounded-full border border-black/15 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50 dark:border-white/15"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor de nuevo pedido */}
      {newOrderType && (
        <PdvOrderEditor
          type={newOrderType}
          menu={menu}
          salas={salas}
          initialMesaId={newOrderMesaId ?? undefined}
          onClose={() => {
            setNewOrderType(null);
            setNewOrderMesaId(null);
          }}
          onCreated={() => {
            setNewOrderType(null);
            setNewOrderMesaId(null);
            refetch();
          }}
        />
      )}

      {/* Agregar productos a un pedido abierto */}
      {appendOrder && (
        <PdvOrderEditor
          type={appendOrder.type}
          menu={menu}
          salas={salas}
          appendToOrder={{ id: appendOrder.id, code: appendOrder.code }}
          onClose={() => setAppendOrder(null)}
          onCreated={() => {
            setAppendOrder(null);
            refetch();
          }}
        />
      )}

      {/* Modal de pago */}
      {payingOrder && (
        <PdvPaymentModal
          order={payingOrder}
          onClose={() => setPayingOrder(null)}
          onPaid={() => {
            setPayingOrder(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
