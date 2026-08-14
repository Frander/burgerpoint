import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WHATSAPP } from "@/lib/whatsapp/config";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Entrada de mensajes desde Meta: validación de firma y lectura del payload.
 *
 * La URL del webhook es pública, así que la firma es lo único que separa un
 * mensaje real de cualquiera que descubra la dirección.
 */

/**
 * Verifica `X-Hub-Signature-256` sobre el cuerpo EXACTO que mandó Meta.
 * Hay que firmar el texto crudo: si se hace JSON.parse y luego stringify, el
 * resultado ya no es byte por byte el mismo y la firma nunca coincide.
 */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = WHATSAPP.appSecret;
  if (!secret || !header) return false;

  const esperado = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const recibido = header.startsWith("sha256=") ? header.slice(7) : header;

  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(recibido, "hex");
  // timingSafeEqual exige el mismo largo; distinta longitud ya es rechazo.
  if (a.length !== b.length || a.length === 0) return false;

  return timingSafeEqual(a, b);
}

export interface InboundMessage {
  wamid: string;
  from: string;
  /** Texto ya extraído, sea de un mensaje normal o de un botón/lista. */
  text: string;
  profileName: string | null;
  /** Tipo original de Meta: 'text', 'interactive', 'audio'… */
  type: string;
}

interface MetaPayload {
  object?: string;
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: {
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
        }[];
        statuses?: { id?: string; status?: string }[];
      };
    }[];
  }[];
}

/** Saca los mensajes entrantes del payload (Meta los manda anidados y en lote). */
export function parseInbound(payload: unknown): InboundMessage[] {
  const data = payload as MetaPayload;
  const salida: InboundMessage[] = [];

  for (const entry of data?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;

      const nombre = value.contacts?.[0]?.profile?.name ?? null;

      for (const msg of value.messages) {
        if (!msg.id || !msg.from) continue;

        // Los botones y listas traen el texto en otro lado; si algún día se usan
        // se leen igual que un mensaje escrito.
        const texto =
          msg.text?.body ??
          msg.interactive?.button_reply?.title ??
          msg.interactive?.list_reply?.title ??
          msg.button?.text ??
          "";

        salida.push({
          wamid: msg.id,
          from: msg.from,
          text: texto,
          profileName: nombre,
          type: msg.type ?? "text",
        });
      }
    }
  }

  return salida;
}

/** Acuses de entrega/lectura, para la bitácora. */
export function parseStatuses(payload: unknown): { wamid: string; status: string }[] {
  const data = payload as MetaPayload;
  const salida: { wamid: string; status: string }[] = [];

  for (const entry of data?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const st of change.value?.statuses ?? []) {
        if (st.id && st.status) salida.push({ wamid: st.id, status: st.status });
      }
    }
  }

  return salida;
}

/**
 * Registra el mensaje entrante. Devuelve false si ese `wamid` ya estaba: Meta
 * reintenta el mismo evento cuando no le contestamos 200 a tiempo, y sin esto
 * el bot procesaría dos veces el mismo mensaje.
 */
export async function claimInbound(msg: InboundMessage): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return true;

  const { error } = await supabase.from("wa_messages").insert({
    direction: "in",
    phone: msg.from,
    wamid: msg.wamid,
    kind: msg.type,
    body: msg.text,
    status: "received",
  });

  if (error) {
    if (error.code === "23505") return false; // ya procesado
    console.warn("[whatsapp] no se pudo registrar el entrante:", error.message);
  }

  return true;
}

/** Guarda el acuse (sent → delivered → read) en la fila del mensaje saliente. */
export async function recordStatus(wamid: string, status: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from("wa_messages").update({ status }).eq("wamid", wamid);
}
