import "server-only";
import { formatMoney } from "@/lib/format";
import { WHATSAPP, WA_TEMPLATES, isWhatsappConfigured } from "@/lib/whatsapp/config";
import { sendTemplate } from "@/lib/whatsapp/client";
import type { OrderType } from "@/lib/types";

const TYPE_LABEL: Record<OrderType, string> = {
  delivery: "A domicilio",
  pickup: "Para llevar",
  en_local: "En el local",
  en_mesa: "En mesa",
};

export interface NewOrderAlert {
  orderId: string;
  code: string;
  type: OrderType;
  customerName: string;
  total: number;
}

/**
 * Fase 1 — avisa al número interno que entró un pedido.
 *
 * Va siempre como plantilla: ese número nunca nos escribe, así que jamás hay
 * ventana de 24 h abierta y Meta no acepta texto libre. Es el único de los tres
 * flujos que cuesta dinero (tarifa de utilidad).
 *
 * Nunca lanza: un fallo de WhatsApp no puede tumbar la creación de un pedido.
 */
export async function notifyNewOrder(order: NewOrderAlert): Promise<void> {
  if (!isWhatsappConfigured() || !WHATSAPP.alertTo) return;

  try {
    await sendTemplate({
      to: WHATSAPP.alertTo,
      template: WA_TEMPLATES.nuevoPedidoAlerta,
      orderId: order.orderId,
      dedupeTag: "alerta",
      variables: [
        order.code,
        TYPE_LABEL[order.type] ?? order.type,
        order.customerName,
        formatMoney(order.total),
      ],
    });
  } catch (err) {
    console.error("[whatsapp] alerta de pedido nuevo:", (err as Error).message);
  }
}
