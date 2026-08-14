import "server-only";
import { formatMoney } from "@/lib/format";
import { WHATSAPP, WA_TEMPLATES, isWhatsappConfigured } from "@/lib/whatsapp/config";
import { sendTemplate, sendText, hasOpenWindow } from "@/lib/whatsapp/client";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUS_META } from "@/lib/orders";
import type { OrderStatus, OrderType } from "@/lib/types";

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

/** Estados que ameritan avisar al cliente. "nuevo" no: acaba de pedir. */
const AVISABLES: OrderStatus[] = ["en_cocina", "listo", "entregado", "cancelado"];

function textoEstado(status: OrderStatus, type: OrderType, code: string): string {
  switch (status) {
    case "en_cocina":
      return `👨‍🍳 ¡Tu pedido *${code}* ya está en preparación!`;
    case "listo":
      return type === "delivery"
        ? `🛵 Tu pedido *${code}* va en camino.`
        : `✅ Tu pedido *${code}* ya está listo para recoger.`;
    case "entregado":
      return `🙏 Tu pedido *${code}* fue entregado. ¡Gracias por tu compra!`;
    case "cancelado":
      return `❌ Tu pedido *${code}* fue cancelado. Si crees que es un error, escríbenos.`;
    default:
      return `Tu pedido *${code}*: ${ORDER_STATUS_META[status]?.label ?? status}.`;
  }
}

/**
 * ¿Se pueden gastar plantillas de pago para avisar a quien pidió por la web?
 *
 * Apagado por defecto a propósito: dentro de la ventana de 24 h el aviso es
 * gratis, pero quien pidió por la web nunca nos escribió, así que su aviso se
 * cobra (~USD $0.008). Encenderlo es una decisión de dinero, no técnica.
 */
function permitePlantillaDeEstado(): boolean {
  const raw = (process.env.WHATSAPP_STATUS_TEMPLATES ?? "").toLowerCase();
  return raw === "1" || raw === "true" || raw === "si";
}

/**
 * Fase 2 — avisa al cliente que su pedido cambió de estado.
 *
 * Elige solo el canal más barato que funcione:
 *   - ventana de 24 h abierta (el cliente escribió hace poco) → texto libre, gratis.
 *   - cerrada → plantilla de pago, y solo si WHATSAPP_STATUS_TEMPLATES lo permite.
 *
 * Idempotente por `(order_id, 'estado:<status>')`: aunque el staff avance y
 * retroceda el estado, cada aviso sale una sola vez.
 *
 * Nunca lanza: un fallo de WhatsApp no puede tumbar el cambio de estado.
 */
export async function notifyOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  if (!isWhatsappConfigured()) return;
  if (!AVISABLES.includes(status)) return;

  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { data } = await supabase
      .from("orders")
      .select("code, type, customer_name, customer_phone")
      .eq("id", orderId)
      .maybeSingle();

    const order = data as {
      code: string;
      type: OrderType;
      customer_name: string;
      customer_phone: string | null;
    } | null;
    if (!order) return;

    const phone = normalizePhone(order.customer_phone, WHATSAPP.defaultCountryCode);
    if (!phone) return;

    // Quien pidió la baja no recibe nada, ni gratis.
    const { data: contacto } = await supabase
      .from("wa_contacts")
      .select("opted_out")
      .eq("phone", phone)
      .maybeSingle();
    if ((contacto as { opted_out: boolean } | null)?.opted_out) return;

    const dedupeTag = `estado:${status}`;

    if (await hasOpenWindow(phone)) {
      await sendText({
        to: phone,
        orderId,
        dedupeTag,
        body: textoEstado(status, order.type, order.code),
      });
      return;
    }

    if (!permitePlantillaDeEstado()) return;

    await sendTemplate({
      to: phone,
      template: WA_TEMPLATES.estadoPedido,
      orderId,
      dedupeTag,
      variables: [
        order.customer_name,
        order.code,
        ORDER_STATUS_META[status]?.label ?? status,
      ],
    });
  } catch (err) {
    console.error("[whatsapp] aviso de estado:", (err as Error).message);
  }
}
