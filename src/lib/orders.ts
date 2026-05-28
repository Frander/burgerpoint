import type { OrderStatus } from "@/lib/types";

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
