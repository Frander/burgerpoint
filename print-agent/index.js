// Agente local de impresión — Burger Point
// ------------------------------------------------
// Corre en la PC de la caja (Windows) con la impresora térmica USB
// compartida. Escucha pedidos en Supabase (Realtime) y los imprime
// automáticamente (ticket de cliente y/o comanda de cocina).
//
// Uso:
//   node index.js               → servicio normal
//   node index.js --test        → imprime un ticket de prueba y sale
//   node index.js --dry-run     → no imprime: guarda .bin y .txt en out/
//   node index.js --order <id>  → imprime un pedido específico y sale

import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clientTicket, kitchenTicket, previewText } from "./ticket.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(HERE, "config.json");
const STATE_PATH = path.join(HERE, "state.json");
const OUT_DIR = path.join(HERE, "out");

// ---------- Configuración ----------
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(
    "Falta config.json. Copia config.example.json a config.json y rellena tus datos.",
  );
  process.exit(1);
}
const config = {
  columns: 48,
  copies: { cliente: 1, cocina: 1 },
  autoPrint: { cliente: true, cocina: true },
  // Estados que disparan la impresión automática.
  printOnStatus: ["en_cocina"],
  printerShare: "\\\\localhost\\POS80",
  printerName: "", // macOS/Linux (lp -d), solo para pruebas
  business: {
    name: "Burguer Point",
    address: "México 188 246, Ticul, 97864 Ticul, Yuc., México",
    siteUrl: "http://localhost:3000",
  },
  ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")),
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run") || config.dryRun === true;
const TEST = args.includes("--test");
const ORDER_ARG = args.includes("--order")
  ? args[args.indexOf("--order") + 1]
  : null;

// ---------- Estado (para no imprimir dos veces) ----------
let state = { printed: {} };
try {
  state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
} catch {
  /* primera corrida */
}
function markPrinted(id) {
  state.printed[id] = Date.now();
  // Limpieza: olvida pedidos de hace más de 2 días.
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  for (const [k, v] of Object.entries(state.printed)) {
    if (v < cutoff) delete state.printed[k];
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// ---------- Impresión en crudo ----------
function sendRaw(buffer, label) {
  const file = path.join(
    os.tmpdir(),
    `bp-ticket-${Date.now()}-${Math.floor(Math.random() * 1e4)}.bin`,
  );
  fs.writeFileSync(file, buffer);

  return new Promise((resolve, reject) => {
    const done = (err) => {
      fs.unlink(file, () => {});
      if (err) reject(err);
      else {
        console.log(`🖨  Impreso: ${label}`);
        resolve();
      }
    };
    if (process.platform === "win32") {
      // La impresora debe estar COMPARTIDA (p. ej. como POS80).
      execFile(
        "cmd.exe",
        ["/c", "copy", "/b", file, config.printerShare],
        (err) => done(err),
      );
    } else {
      // macOS/Linux (pruebas): impresión cruda vía CUPS.
      const printer = config.printerName || "POS80";
      execFile("lp", ["-d", printer, "-o", "raw", file], (err) => done(err));
    }
  });
}

async function output(buffer, order, kind) {
  if (DRY_RUN) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const base = path.join(OUT_DIR, `${order.code}-${kind}`);
    fs.writeFileSync(`${base}.bin`, buffer);
    fs.writeFileSync(
      `${base}.txt`,
      previewText(order, { business: config.business, mesaName: order._mesaName }),
    );
    console.log(`📝 dry-run: ${base}.bin / .txt`);
    return;
  }
  const copies = config.copies?.[kind] ?? 1;
  for (let i = 0; i < copies; i++) {
    await sendRaw(buffer, `${order.code} (${kind}${copies > 1 ? ` ${i + 1}/${copies}` : ""})`);
  }
}

// ---------- Supabase ----------
const { supabaseUrl, supabaseAnonKey, email, password } = config;
if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
  console.error(
    "config.json debe incluir: supabaseUrl, supabaseAnonKey, email y password (usuario del staff).",
  );
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: true },
});

async function fetchOrder(id) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*, order_item_modifiers(*)), order_payments(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function mesaNameOf(order) {
  if (!order.mesa_id) return null;
  const { data } = await supabase
    .from("mesas")
    .select("name")
    .eq("id", order.mesa_id)
    .maybeSingle();
  return data?.name ?? null;
}

async function printOrder(order, { force = false } = {}) {
  if (!force && state.printed[order.id]) return;
  order._mesaName = await mesaNameOf(order);
  const opts = {
    business: config.business,
    mesaName: order._mesaName,
    columns: config.columns,
  };
  try {
    if (config.autoPrint?.cocina !== false || force) {
      await output(kitchenTicket(order, opts), order, "cocina");
    }
    if (config.autoPrint?.cliente !== false || force) {
      await output(clientTicket(order, opts), order, "cliente");
    }
    markPrinted(order.id);
  } catch (err) {
    console.error(`❌ Error imprimiendo ${order.code}:`, err.message);
  }
}

function shouldAutoPrint(order) {
  return (
    order &&
    (config.printOnStatus ?? ["en_cocina"]).includes(order.status) &&
    !state.printed[order.id]
  );
}

// ---------- Modos de un solo uso ----------
async function main() {
  if (TEST) {
    const now = new Date().toISOString();
    const fake = {
      id: "test",
      code: "PRUEBA-0000",
      customer_name: "Ticket de prueba",
      customer_phone: "9990000000",
      type: "delivery",
      address: "Calle de prueba #123, Ticul",
      status: "en_cocina",
      origin: "pdv",
      payment_status: "pagado",
      delivery_fee: 5,
      total: 154,
      notes: "Esto es una prueba de impresión",
      created_at: now,
      served_by: "Agente",
      order_items: [
        {
          id: "i1",
          product_name: "Combo Esencial",
          quantity: 1,
          unit_price: 69,
          notes: null,
          order_item_modifiers: [
            { id: "m1", modifier_name: "Jamaica", extra_price: 0 },
          ],
        },
        {
          id: "i2",
          product_name: "Papa point",
          quantity: 1,
          unit_price: 80,
          notes: "Aparte todo",
          order_item_modifiers: [],
        },
      ],
      order_payments: [
        { id: "p1", method: "efectivo", amount: 154, received: 200 },
      ],
    };
    await printOrder(fake, { force: true });
    process.exit(0);
  }

  const { error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr) {
    console.error("No se pudo iniciar sesión en Supabase:", authErr.message);
    process.exit(1);
  }
  console.log(`✅ Sesión iniciada como ${email}`);

  if (ORDER_ARG) {
    const order = await fetchOrder(ORDER_ARG);
    if (!order) {
      console.error("No existe ese pedido.");
      process.exit(1);
    }
    await printOrder(order, { force: true });
    process.exit(0);
  }

  // ---------- Servicio: Realtime + barrido de respaldo ----------
  console.log(
    `👂 Escuchando pedidos (estado: ${(config.printOnStatus ?? ["en_cocina"]).join(", ")})…`,
  );

  supabase
    .channel("print-agent-orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      async (payload) => {
        const row = payload.new;
        if (!row?.id) return;
        if (!shouldAutoPrint(row)) return;
        try {
          const order = await fetchOrder(row.id);
          if (shouldAutoPrint(order)) await printOrder(order);
        } catch (err) {
          console.error("Error al procesar evento:", err.message);
        }
      },
    )
    .subscribe((status) => {
      console.log(`Realtime: ${status}`);
    });

  // Barrido cada 90s por si Realtime perdió algún evento.
  setInterval(async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*, order_item_modifiers(*)), order_payments(*)")
        .in("status", config.printOnStatus ?? ["en_cocina"])
        .gte("created_at", oneHourAgo);
      for (const order of data ?? []) {
        if (shouldAutoPrint(order)) {
          console.log(`🔎 Barrido: pedido ${order.code} sin imprimir.`);
          await printOrder(order);
        }
      }
    } catch (err) {
      console.error("Error en barrido:", err.message);
    }
  }, 90_000);
}

main();
