import { after } from "next/server";
import type { NextRequest } from "next/server";
import { WHATSAPP } from "@/lib/whatsapp/config";
import { sendText } from "@/lib/whatsapp/client";
import { maskPhone } from "@/lib/whatsapp/phone";
import {
  claimInbound,
  parseInbound,
  parseStatuses,
  recordStatus,
  verifySignature,
} from "@/lib/whatsapp/webhook";
import { alertaPedidoBot, handleIncoming } from "@/lib/whatsapp/bot";
import { pruneSessions, touchContact } from "@/lib/whatsapp/session";

/**
 * Webhook de WhatsApp (Cloud API de Meta).
 *
 * GET  — verificación inicial: Meta llama una vez con un token y espera que le
 *        devolvamos el `challenge` tal cual.
 * POST — mensajes entrantes. Se contesta 200 de inmediato y el bot trabaja en
 *        `after()`: si Meta no recibe respuesta en pocos segundos reintenta el
 *        mismo evento, y acabaríamos contestando dos veces.
 */

// El webhook depende de la firma y del cuerpo de cada petición: nunca se cachea.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (!WHATSAPP.verifyToken) {
    console.error("[whatsapp] falta WHATSAPP_VERIFY_TOKEN");
    return new Response("Not configured", { status: 503 });
  }

  if (mode === "subscribe" && token === WHATSAPP.verifyToken && challenge) {
    // Meta espera el challenge en texto plano, sin comillas ni JSON.
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  // El cuerpo crudo es lo que se firma: no se puede parsear antes de validar.
  const raw = await request.text();

  if (!WHATSAPP.appSecret) {
    console.error("[whatsapp] falta WHATSAPP_APP_SECRET: no se puede validar la firma");
    return new Response("Not configured", { status: 503 });
  }

  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    console.warn("[whatsapp] firma inválida en el webhook");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  after(async () => {
    try {
      await procesar(payload);
    } catch (err) {
      console.error("[whatsapp] webhook:", (err as Error).message);
    }
  });

  return new Response("EVENT_RECEIVED", { status: 200 });
}

async function procesar(payload: unknown) {
  for (const { wamid, status } of parseStatuses(payload)) {
    await recordStatus(wamid, status);
  }

  const mensajes = parseInbound(payload);
  if (mensajes.length === 0) return;

  // Barre conversaciones abandonadas aprovechando que ya hay tráfico.
  await pruneSessions();

  for (const msg of mensajes) {
    // Meta reintenta: si este wamid ya estaba, no se vuelve a contestar.
    if (!(await claimInbound(msg))) continue;

    // El cliente escribió: se abre la ventana de 24 h (respuestas gratis).
    await touchContact(msg.from, msg.profileName);

    if (!msg.text.trim()) {
      await sendText({
        to: msg.from,
        body: "Por ahora solo entiendo mensajes de texto. Escribe *menu* para ver la carta. 🍔",
      });
      continue;
    }

    try {
      const respuesta = await handleIncoming(msg.from, msg.text, msg.profileName);

      for (const cuerpo of respuesta.mensajes) {
        await sendText({ to: msg.from, body: cuerpo });
      }

      if (respuesta.pedido) {
        await alertaPedidoBot(respuesta.pedido);
      }
    } catch (err) {
      console.error(`[whatsapp] bot ${maskPhone(msg.from)}:`, (err as Error).message);
      await sendText({
        to: msg.from,
        body: "Tuve un problema procesando tu mensaje. 😔 Escribe *menu* para empezar de nuevo.",
      });
    }
  }
}
