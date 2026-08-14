import type { NextRequest } from "next/server";
import { handleIncoming } from "@/lib/whatsapp/bot";

/**
 * Simulador del bot: recibe un mensaje y DEVUELVE lo que contestaría, sin
 * pasar por Meta. Sirve para probar el flujo completo antes de conectar la app
 * de Facebook, y para depurar después sin gastar mensajes.
 *
 * Apagado salvo que `WHATSAPP_SIMULATOR=1`. Sin esa variable responde 404, así
 * que en producción no existe a menos que se encienda a propósito.
 *
 * Ojo: los pedidos que confirmes aquí SÍ se crean de verdad (aparecen en el
 * panel con origen WhatsApp). Es justo lo que se quiere probar.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (process.env.WHATSAPP_SIMULATOR !== "1") {
    return new Response("Not found", { status: 404 });
  }

  let body: { phone?: string; text?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const phone = (body.phone ?? "").replace(/\D/g, "");
  const text = body.text ?? "";

  if (!phone || !text) {
    return Response.json({ error: "Faltan 'phone' y 'text'" }, { status: 400 });
  }

  const respuesta = await handleIncoming(phone, text, body.name ?? null);

  // La alerta interna no se dispara aquí a propósito: el simulador no debe
  // gastar plantillas de pago cada vez que se prueba el flujo.
  return Response.json({
    mensajes: respuesta.mensajes,
    pedido: respuesta.pedido ?? null,
  });
}
