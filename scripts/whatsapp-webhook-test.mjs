#!/usr/bin/env node
/**
 * Simula una llamada de Meta al webhook, firmada como lo hace Meta.
 *
 *   node scripts/whatsapp-webhook-test.mjs "hola"
 *
 * Lee WHATSAPP_APP_SECRET del entorno (o --env-file=.env.local). Sirve para
 * comprobar que la firma se valida bien sin depender de que Meta esté conectado.
 * Con --mala manda una firma inválida: debe responder 401.
 */

import { createHmac } from "node:crypto";
import { argv, env, exit } from "node:process";

const BASE = env.SIM_URL ?? "http://localhost:3000";
const PHONE = env.SIM_PHONE ?? "5219991112233";
const SECRET = env.WHATSAPP_APP_SECRET;

if (!SECRET) {
  console.error("Falta WHATSAPP_APP_SECRET (usa node --env-file=.env.local ...)");
  exit(1);
}

const texto = argv.find((a) => !a.startsWith("--") && a !== argv[0] && a !== argv[1]) ?? "hola";
const mala = argv.includes("--mala");
const wamid = `wamid.TEST${Date.now()}`;

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "0",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "0", phone_number_id: "0" },
            contacts: [{ profile: { name: "Cliente de prueba" }, wa_id: PHONE }],
            messages: [
              {
                from: PHONE,
                id: wamid,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: texto },
              },
            ],
          },
        },
      ],
    },
  ],
};

const raw = JSON.stringify(payload);
const firma = mala
  ? "sha256=" + "0".repeat(64)
  : "sha256=" + createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");

const res = await fetch(`${BASE}/api/whatsapp`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Hub-Signature-256": firma },
  body: raw,
});

console.log(`firma ${mala ? "INVÁLIDA" : "válida"} → HTTP ${res.status}: ${await res.text()}`);
console.log(`wamid: ${wamid}`);
