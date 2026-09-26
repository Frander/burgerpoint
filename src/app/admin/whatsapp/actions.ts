"use server";

import { revalidatePath } from "next/cache";
import { assertSection } from "@/lib/supabase/auth";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";
import { hasOpenWindow, sendText } from "@/lib/whatsapp/client";
import { recordStaffReply, setBotPaused } from "@/lib/whatsapp/session";
import { mensajeAlRetomar } from "@/lib/whatsapp/bot";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { registerPayment } from "@/app/admin/pdv/actions";

type Result = { ok: boolean; error?: string };

/** Meta corta el texto libre en 4096 caracteres. */
const MAX_LEN = 4096;

/**
 * Respuesta escrita a mano desde el panel. Pausa el bot de ese teléfono para
 * que no conteste encima de la persona.
 */
export async function replyToContact(phone: string, body: string): Promise<Result> {
  await assertSection("whatsapp");

  const text = body.trim();
  if (!/^\d{8,15}$/.test(phone)) return { ok: false, error: "Teléfono inválido." };
  if (!text) return { ok: false, error: "Escribe un mensaje." };
  if (text.length > MAX_LEN) {
    return { ok: false, error: `El mensaje pasa de ${MAX_LEN} caracteres.` };
  }
  if (!isWhatsappConfigured()) {
    return { ok: false, error: "WhatsApp no está configurado en el servidor." };
  }
  // Fuera de la ventana Meta rechaza el texto libre; mejor decirlo aquí que
  // mostrar un error de la Graph API.
  if (!(await hasOpenWindow(phone))) {
    return {
      ok: false,
      error:
        "Pasaron más de 24 h desde su último mensaje (o pidió la baja). WhatsApp solo deja escribirle cuando vuelva a escribir.",
    };
  }

  // Primero la pausa: si el cliente contesta mientras sale el envío, el bot ya
  // no se mete.
  await setBotPaused(phone, true);

  // La etiqueta distingue en la bandeja lo que escribió una persona de lo que
  // mandó el bot. No choca con el índice de avisos: ese exige order_id.
  const result = await sendText({ to: phone, body: text, dedupeTag: "manual" });
  // Para que al reactivar el bot la IA sepa qué se le dijo al cliente.
  if (result.ok) await recordStaffReply(phone, text);

  revalidatePath("/admin/whatsapp");
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "No se pudo enviar." };
}

/** Botón "Pausar bot" / "Reactivar bot" de la conversación. */
export async function toggleBot(phone: string, paused: boolean): Promise<Result> {
  await assertSection("whatsapp");
  if (!/^\d{8,15}$/.test(phone)) return { ok: false, error: "Teléfono inválido." };

  const retomada = await setBotPaused(phone, paused);

  // Al reactivarlo, el cliente no sabe que volvió el bot: se le recuerda lo que
  // llevaba y qué contestar (si hay carrito y todavía se le puede escribir).
  if (retomada && isWhatsappConfigured() && (await hasOpenWindow(phone))) {
    const mensaje = await mensajeAlRetomar(retomada);
    if (mensaje) await sendText({ to: phone, body: mensaje });
  }

  revalidatePath("/admin/whatsapp");
  return { ok: true };
}

/** Se abrió la conversación: deja de contar como pendiente para todo el staff. */
export async function markConversationRead(phone: string): Promise<Result> {
  await assertSection("whatsapp");
  if (!/^\d{8,15}$/.test(phone)) return { ok: false, error: "Teléfono inválido." };

  const supabase = createAdminClient() ?? (await createClient());
  const { error } = await supabase
    .from("wa_contacts")
    .update({ last_read_at: new Date().toISOString() })
    .eq("phone", phone);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Botón "Confirmar pago" de la conversación: registra por transferencia lo que
 * falte del pedido. registerPayment ya marca el pedido pagado (trigger de la
 * base), da los puntos y le manda al cliente el WhatsApp de pago verificado.
 */
export async function confirmTransferPayment(orderId: string): Promise<Result> {
  await assertSection("whatsapp");

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("total, payment_status, order_payments(amount)")
    .eq("id", orderId)
    .maybeSingle();

  const order = data as {
    total: number;
    payment_status: string;
    order_payments: { amount: number }[];
  } | null;
  if (!order) return { ok: false, error: "No encontré ese pedido." };
  if (order.payment_status === "pagado") return { ok: false, error: "Ese pedido ya está pagado." };

  const pagado = order.order_payments.reduce((s, p) => s + Number(p.amount), 0);
  const falta = Math.round((Number(order.total) - pagado) * 100) / 100;
  if (!(falta > 0)) return { ok: false, error: "No queda nada por cobrar." };

  const res = await registerPayment(orderId, "transferencia", falta);
  revalidatePath("/admin/whatsapp");
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "No se pudo registrar el pago." };
}
