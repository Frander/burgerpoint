import "server-only";
import { formatMoney } from "@/lib/format";
import { WHATSAPP, WA_TEMPLATES, isWhatsappConfigured } from "@/lib/whatsapp/config";
import { sendTemplate, sendText, hasOpenWindow } from "@/lib/whatsapp/client";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderStatusLabel } from "@/lib/orders";
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
      return `Tu pedido *${code}*: ${orderStatusLabel(status, type)}.`;
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
        orderStatusLabel(status, order.type),
      ],
    });
  } catch (err) {
    console.error("[whatsapp] aviso de estado:", (err as Error).message);
  }
}

/**
 * Manda el código de acceso del programa de puntos.
 *
 * Un código es de esos mensajes que el cliente NO pidió por chat, así que casi
 * siempre cae fuera de la ventana de 24 h y hay que gastar plantilla. Se
 * intenta primero la plantilla de autenticación (`WA_TPL_CODIGO`) y, si no está
 * configurada o el cliente escribió hace poco, se manda como texto.
 *
 * Devuelve false cuando no salió, para que la pantalla lo diga en vez de dejar
 * al cliente esperando un mensaje que nunca llega.
 */
export async function sendAccessCode(
  rawPhone: string,
  code: string,
): Promise<boolean> {
  if (!isWhatsappConfigured()) return false;

  const phone = normalizePhone(rawPhone);
  if (!phone) return false;

  const plantilla = process.env.WA_TPL_CODIGO;

  try {
    if (plantilla && !(await hasOpenWindow(phone))) {
      const res = await sendTemplate({
        to: phone,
        template: plantilla,
        variables: [code],
      });
      return res.ok;
    }

    const res = await sendText({
      to: phone,
      body: `Tu código de Burger Point es *${code}*. Vence en 10 minutos. Si no lo pediste, ignora este mensaje.`,
    });
    return res.ok;
  } catch (err) {
    console.error("[whatsapp] código de acceso:", (err as Error).message);
    return false;
  }
}

/** Tope del detalle en la plantilla: Meta corta el cuerpo en 1024 caracteres. */
const DETALLE_MAX = 600;

/**
 * Confirma al cliente un pedido a domicilio hecho desde la web, con su nombre,
 * lo que pidió y el total.
 *
 * Quien pide por la web casi nunca nos ha escrito, así que va como plantilla
 * (`WA_TPL_CONFIRMACION`, por defecto `pedido_confirmado`). Si escribió en las
 * últimas 24 h sale como texto, gratis y con el detalle en renglones.
 *
 * Una sola vez por pedido (`confirmacion`). Nunca lanza.
 */
export async function notifyOrderConfirmation(orderId: string): Promise<void> {
  if (!isWhatsappConfigured()) return;

  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { data } = await supabase
      .from("orders")
      .select(
        "code, customer_name, customer_phone, total, delivery_fee, order_items(product_name, quantity, order_item_modifiers(modifier_name))",
      )
      .eq("id", orderId)
      .maybeSingle();

    const order = data as {
      code: string;
      customer_name: string;
      customer_phone: string | null;
      total: number;
      delivery_fee: number;
      order_items: {
        product_name: string;
        quantity: number;
        order_item_modifiers: { modifier_name: string }[] | null;
      }[];
    } | null;
    if (!order) return;

    const phone = normalizePhone(order.customer_phone, WHATSAPP.defaultCountryCode);
    if (!phone) return;

    const { data: contacto } = await supabase
      .from("wa_contacts")
      .select("opted_out")
      .eq("phone", phone)
      .maybeSingle();
    if ((contacto as { opted_out: boolean } | null)?.opted_out) return;

    const lineas = order.order_items.map((i) => {
      const extras = (i.order_item_modifiers ?? []).map((m) => m.modifier_name);
      return `${i.quantity}x ${i.product_name}${extras.length ? ` (${extras.join(", ")})` : ""}`;
    });
    if (Number(order.delivery_fee) > 0) {
      lineas.push(`Envío ${formatMoney(Number(order.delivery_fee))}`);
    }
    const total = formatMoney(Number(order.total));
    const nombre = order.customer_name.trim().split(/\s+/)[0] || order.customer_name;

    if (await hasOpenWindow(phone)) {
      await sendText({
        to: phone,
        orderId,
        dedupeTag: "confirmacion",
        body:
          `🍔 ¡Gracias ${nombre}! Recibimos tu pedido *${order.code}*.\n\n` +
          `${lineas.map((l) => `• ${l}`).join("\n")}\n\n` +
          `*Total: ${total}*\n\nTe avisamos cuando vaya en camino. 🛵`,
      });
      return;
    }

    // En la plantilla el detalle va en una sola línea: Meta no acepta saltos
    // de línea dentro de una variable.
    let detalle = lineas.join(", ");
    if (detalle.length > DETALLE_MAX) detalle = `${detalle.slice(0, DETALLE_MAX - 1)}…`;

    await sendTemplate({
      to: phone,
      template: WA_TEMPLATES.confirmacionPedido,
      orderId,
      dedupeTag: "confirmacion",
      variables: [nombre, order.code, detalle, total],
    });
  } catch (err) {
    console.error("[whatsapp] confirmación de pedido:", (err as Error).message);
  }
}

/**
 * Le avisa al cliente que su transferencia ya se verificó y el pedido quedó
 * pagado. Mismo criterio que los avisos de estado: texto libre gratis dentro de
 * la ventana de 24 h; fuera de ella, la plantilla `pedido_estado` solo si
 * WHATSAPP_STATUS_TEMPLATES lo permite. Sale una sola vez por pedido.
 *
 * Nunca lanza: un fallo de WhatsApp no puede tumbar el cobro.
 */
export async function notifyPaymentConfirmed(orderId: string): Promise<void> {
  if (!isWhatsappConfigured()) return;

  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { data } = await supabase
      .from("orders")
      .select("code, type, customer_name, customer_phone, total, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    const order = data as {
      code: string;
      type: OrderType;
      customer_name: string;
      customer_phone: string | null;
      total: number;
      payment_status: string;
    } | null;
    // Un abono parcial no se festeja: el aviso es para cuando ya quedó pagado.
    if (!order || order.payment_status !== "pagado") return;

    const phone = normalizePhone(order.customer_phone, WHATSAPP.defaultCountryCode);
    if (!phone) return;

    const { data: contacto } = await supabase
      .from("wa_contacts")
      .select("opted_out")
      .eq("phone", phone)
      .maybeSingle();
    if ((contacto as { opted_out: boolean } | null)?.opted_out) return;

    const nombre = order.customer_name.trim().split(/\s+/)[0] || order.customer_name;

    if (await hasOpenWindow(phone)) {
      await sendText({
        to: phone,
        orderId,
        dedupeTag: "pago",
        body:
          `✅ ¡Gracias ${nombre}! Verificamos tu pago de *${formatMoney(Number(order.total))}* ` +
          `del pedido *${order.code}*. Ya quedó pagado. 🍔`,
      });
      return;
    }

    if (!permitePlantillaDeEstado()) return;

    await sendTemplate({
      to: phone,
      template: WA_TEMPLATES.estadoPedido,
      orderId,
      dedupeTag: "pago",
      variables: [order.customer_name, order.code, "Pago confirmado"],
    });
  } catch (err) {
    console.error("[whatsapp] aviso de pago:", (err as Error).message);
  }
}
