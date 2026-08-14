#!/usr/bin/env node
/**
 * Chatea con el bot de WhatsApp desde la terminal, sin Meta.
 *
 *   npm run dev                                   # en otra terminal
 *   node scripts/whatsapp-bot-sim.mjs             # modo conversación
 *   node scripts/whatsapp-bot-sim.mjs "hola|1|1"  # guion automático
 *
 * Requiere WHATSAPP_SIMULATOR=1 en .env.local (si no, la ruta responde 404).
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, exit } from "node:process";

const BASE = process.env.SIM_URL ?? "http://localhost:3000";
const PHONE = process.env.SIM_PHONE ?? "5219991112233";
const NAME = process.env.SIM_NAME ?? "Cliente de prueba";

async function enviar(text) {
  let res;
  try {
    res = await fetch(`${BASE}/api/whatsapp/simular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: PHONE, text, name: NAME }),
    });
  } catch (err) {
    console.error(`\n❌ No pude conectar con ${BASE}. ¿Corriste "npm run dev"?`);
    console.error(`   ${err.message}`);
    exit(1);
  }

  if (res.status === 404) {
    console.error("\n❌ El simulador está apagado. Pon WHATSAPP_SIMULATOR=1 en .env.local y reinicia el server.");
    exit(1);
  }

  if (!res.ok) {
    console.error(`\n❌ HTTP ${res.status}: ${await res.text()}`);
    exit(1);
  }

  const data = await res.json();
  for (const m of data.mensajes ?? []) {
    console.log(`\n\x1b[32m🤖 ${m.replace(/\n/g, "\n   ")}\x1b[0m`);
  }
  if (data.pedido) {
    console.log(`\n\x1b[33m📦 Pedido creado: ${data.pedido.code} — total ${data.pedido.total}\x1b[0m`);
  }
  return data;
}

const guion = argv[2];

if (guion) {
  for (const paso of guion.split("|")) {
    console.log(`\n\x1b[36m👤 ${paso}\x1b[0m`);
    await enviar(paso);
  }
  exit(0);
}

console.log(`💬 Simulador del bot — teléfono ${PHONE}`);
console.log('   Escribe "hola" para empezar. Ctrl+C para salir.\n');

const rl = createInterface({ input: stdin, output: stdout });
for (;;) {
  const texto = await rl.question("\n\x1b[36m👤 \x1b[0m");
  if (!texto.trim()) continue;
  await enviar(texto);
}
