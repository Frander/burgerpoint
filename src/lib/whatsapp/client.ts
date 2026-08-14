import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { WHATSAPP, isWhatsappConfigured } from "@/lib/whatsapp/config";
import { maskPhone } from "@/lib/whatsapp/phone";

export interface SendResult {
  ok: boolean;
  /** true cuando no se mandó nada a propósito (sin configurar o ya enviado). */
  skipped?: boolean;
  wamid?: string;
  error?: string;
}

interface BaseOptions {
  /** Destinatario en E.164 sin '+'. Usa normalizePhone() antes de llamar. */
  to: string;
  orderId?: string | null;
  /**
   * Etiqueta del aviso ('alerta', 'estado:listo'…). Si se pasa junto con
   * orderId, garantiza que ese aviso se manda una sola vez.
   */
  dedupeTag?: string | null;
}

/**
 * Reserva el envío en la bitácora ANTES de llamar a Meta. Si el índice único
 * choca, es que ese aviso ya se mandó y no hay que repetirlo.
 *
 * Devuelve el id de la fila para poder cerrarla luego, o "duplicate".
 */
async function claim(
  opts: BaseOptions & { kind: string; templateName?: string; body: string },
): Promise<{ rowId: string | null; duplicate: boolean }> {
  const supabase = createAdminClient();
  if (!supabase) return { rowId: null, duplicate: false };

  const { data, error } = await supabase
    .from("wa_messages")
    .insert({
      direction: "out",
      phone: opts.to,
      kind: opts.kind,
      template_name: opts.templateName ?? null,
      dedupe_tag: opts.dedupeTag ?? null,
      body: opts.body,
      order_id: opts.orderId ?? null,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  // 23505 = unique_violation: el aviso ya existe.
  if (error) {
    if (error.code === "23505") return { rowId: null, duplicate: true };
    console.warn("[whatsapp] no se pudo registrar el mensaje:", error.message);
    return { rowId: null, duplicate: false };
  }
  return { rowId: (data as { id: string } | null)?.id ?? null, duplicate: false };
}

async function close(
  rowId: string | null,
  patch: { status: string; wamid?: string; error?: string; payload?: unknown },
) {
  if (!rowId) return;
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase
    .from("wa_messages")
    .update({
      status: patch.status,
      wamid: patch.wamid ?? null,
      error: patch.error ?? null,
      payload: patch.payload ?? null,
    })
    .eq("id", rowId);
}

/**
 * Meta rechaza los parámetros de plantilla que traen saltos de línea, tabs o
 * varios espacios seguidos. Un nombre de cliente pegado desde otro lado basta
 * para tumbar el envío, así que se limpia siempre.
 */
function sanitizeVar(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean === "" ? "-" : clean;
}

/** Llamada cruda a la Graph API. */
async function callGraph(payload: Record<string, unknown>): Promise<SendResult> {
  const url = `https://graph.facebook.com/${WHATSAPP.graphVersion}/${WHATSAPP.phoneNumberId}/messages`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
  } catch (err) {
    return { ok: false, error: `Red: ${(err as Error).message}` };
  }

  const json = (await res.json().catch(() => null)) as {
    messages?: { id: string }[];
    error?: { message?: string; code?: number; error_subcode?: number };
  } | null;

  if (!res.ok) {
    const detail = json?.error?.message ?? `HTTP ${res.status}`;
    const code = json?.error?.code ? ` (code ${json.error.code})` : "";
    return { ok: false, error: `${detail}${code}` };
  }

  return { ok: true, wamid: json?.messages?.[0]?.id };
}

/**
 * Mensaje de texto libre. Solo se entrega si el destinatario escribió en las
 * últimas 24 h (ventana de servicio); fuera de ella Meta lo rechaza y hay que
 * usar una plantilla. Dentro de la ventana es gratis.
 */
export async function sendText(
  opts: BaseOptions & { body: string },
): Promise<SendResult> {
  if (!isWhatsappConfigured()) {
    console.warn("[whatsapp] sin configurar: no se envió el texto");
    return { ok: true, skipped: true };
  }

  const { rowId, duplicate } = await claim({ ...opts, kind: "text" });
  if (duplicate) return { ok: true, skipped: true };

  const result = await callGraph({
    to: opts.to,
    type: "text",
    text: { body: opts.body, preview_url: false },
  });

  await close(rowId, {
    status: result.ok ? "sent" : "failed",
    wamid: result.wamid,
    error: result.error,
  });

  if (!result.ok) {
    console.error(`[whatsapp] texto a ${maskPhone(opts.to)}: ${result.error}`);
  }
  return result;
}

/**
 * Plantilla aprobada por Meta. Es lo único que se puede mandar fuera de la
 * ventana de 24 h. Las variables van en el orden {{1}}, {{2}}, … del cuerpo.
 */
export async function sendTemplate(
  opts: BaseOptions & {
    template: string;
    variables?: string[];
    language?: string;
  },
): Promise<SendResult> {
  if (!isWhatsappConfigured()) {
    console.warn(
      `[whatsapp] sin configurar: no se envió la plantilla ${opts.template}`,
    );
    return { ok: true, skipped: true };
  }

  const variables = (opts.variables ?? []).map(sanitizeVar);
  const { rowId, duplicate } = await claim({
    ...opts,
    kind: "template",
    templateName: opts.template,
    body: variables.join(" | "),
  });
  if (duplicate) return { ok: true, skipped: true };

  const result = await callGraph({
    to: opts.to,
    type: "template",
    template: {
      name: opts.template,
      language: { code: opts.language ?? WHATSAPP.templateLang },
      ...(variables.length > 0 && {
        components: [
          {
            type: "body",
            parameters: variables.map((text) => ({ type: "text", text })),
          },
        ],
      }),
    },
  });

  await close(rowId, {
    status: result.ok ? "sent" : "failed",
    wamid: result.wamid,
    error: result.error,
  });

  if (!result.ok) {
    console.error(
      `[whatsapp] plantilla ${opts.template} a ${maskPhone(opts.to)}: ${result.error}`,
    );
  }
  return result;
}

/**
 * ¿El contacto escribió en las últimas 24 h? Si sí, se le puede mandar texto
 * libre gratis; si no, hay que gastar una plantilla.
 */
export async function hasOpenWindow(phone: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("wa_contacts")
    .select("last_inbound_at, opted_out")
    .eq("phone", phone)
    .maybeSingle();

  const contact = data as {
    last_inbound_at: string | null;
    opted_out: boolean;
  } | null;

  if (!contact?.last_inbound_at || contact.opted_out) return false;
  const elapsed = Date.now() - new Date(contact.last_inbound_at).getTime();
  return elapsed < 24 * 60 * 60 * 1000;
}
