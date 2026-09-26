"use server";

import { revalidatePath } from "next/cache";
import { assertSection } from "@/lib/supabase/auth";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";
import { hasOpenWindow, sendText } from "@/lib/whatsapp/client";
import { setBotPaused } from "@/lib/whatsapp/session";

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

  revalidatePath("/admin/whatsapp");
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "No se pudo enviar." };
}

/** Botón "Pausar bot" / "Reactivar bot" de la conversación. */
export async function toggleBot(phone: string, paused: boolean): Promise<Result> {
  await assertSection("whatsapp");
  if (!/^\d{8,15}$/.test(phone)) return { ok: false, error: "Teléfono inválido." };

  await setBotPaused(phone, paused);
  revalidatePath("/admin/whatsapp");
  return { ok: true };
}
