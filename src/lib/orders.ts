import type { OrderStatus, OrderType, PaymentMethod } from "@/lib/types";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  nuevo: {
    label: "Nuevo",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  },
  en_cocina: {
    label: "En cocina",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  },
  listo: {
    label: "Listo",
    className:
      "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300",
  },
  entregado: {
    label: "Entregado",
    className: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  },
};

export const ORDER_TYPE_META: Record<OrderType, { label: string; icon: string }> = {
  en_local: { label: "En el local", icon: "🍽️" },
  pickup: { label: "Para llevar", icon: "🥡" },
  delivery: { label: "A domicilio", icon: "🛵" },
  en_mesa: { label: "Mesa", icon: "🪑" },
};

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; icon: string }> = {
  efectivo: { label: "Efectivo", icon: "💵" },
  tarjeta: { label: "Tarjeta", icon: "💳" },
  transferencia: { label: "Transferencia", icon: "🏦" },
};

/**
 * Etiqueta del estado para mostrar en el panel, con matiz según el tipo de
 * pedido: "listo" en domicilio es "En camino" (ya salió el repartidor), no
 * "Listo" a secas (que suena a "listo para recoger"). Mismo criterio que el
 * aviso de WhatsApp al cliente (`src/lib/whatsapp/notify.ts`).
 */
export function orderStatusLabel(status: OrderStatus, type: OrderType): string {
  if (status === "listo" && type === "delivery") return "En camino";
  return ORDER_STATUS_META[status].label;
}

/** Siguiente estado en el flujo normal, o null si ya es terminal. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "nuevo":
      return "en_cocina";
    case "en_cocina":
      return "listo";
    case "listo":
      return "entregado";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Filtro de estado con el matiz de domicilio
// ---------------------------------------------------------------------------

/**
 * Valores del filtro de estado del historial. Son los estados reales más el
 * pseudo-estado `en_camino`, que no existe en la base: es `listo` + tipo
 * `delivery` (el repartidor ya salió). Por coherencia con la etiqueta que ve
 * el staff, `listo` filtra solo lo que NO es domicilio.
 */
export type OrderStatusFilter = OrderStatus | "en_camino";

export const ORDER_STATUS_FILTERS: {
  value: OrderStatusFilter;
  label: string;
}[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "en_cocina", label: "En cocina" },
  { value: "listo", label: "Listo (mostrador)" },
  { value: "en_camino", label: "En camino (domicilio)" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
];

/** Valida el parámetro `?estado=` de la URL. */
export function parseStatusFilter(raw: unknown): OrderStatusFilter | null {
  return ORDER_STATUS_FILTERS.some((f) => f.value === raw)
    ? (raw as OrderStatusFilter)
    : null;
}

/**
 * Traduce el filtro a condiciones de consulta: qué estado buscar y qué hacer
 * con el tipo de pedido (`delivery` incluido, excluido o indiferente).
 */
export function statusFilterQuery(filter: OrderStatusFilter): {
  status: OrderStatus;
  delivery: "solo" | "excluir" | "indiferente";
} {
  if (filter === "en_camino") return { status: "listo", delivery: "solo" };
  if (filter === "listo") return { status: "listo", delivery: "excluir" };
  return { status: filter, delivery: "indiferente" };
}
