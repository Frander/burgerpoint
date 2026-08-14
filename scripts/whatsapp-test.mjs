// Prueba las credenciales de WhatsApp Cloud API sin tocar la app ni la base.
//
//   node --env-file=.env.local scripts/whatsapp-test.mjs                 # diagnóstico
//   node --env-file=.env.local scripts/whatsapp-test.mjs --alerta        # manda la plantilla de alerta
//   node --env-file=.env.local scripts/whatsapp-test.mjs --texto "hola"  # texto libre (solo con ventana abierta)
//
// Útil para separar "mi configuración de Meta está mal" de "mi código está mal".

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const to = process.env.WHATSAPP_ALERT_TO;
const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const lang = process.env.WHATSAPP_TEMPLATE_LANG || "es_MX";
const tplAlerta = process.env.WA_TPL_ALERTA || "pedido_nuevo_alerta";

const args = process.argv.slice(2);
const wants = (flag) => args.includes(flag);

function check(label, value, hint) {
  const ok = Boolean(value);
  console.log(`  ${ok ? "✓" : "✗"} ${label}${ok ? "" : `  → ${hint}`}`);
  return ok;
}

console.log("\nConfiguración:");
let ready = true;
ready = check("WHATSAPP_ACCESS_TOKEN", token, "falta el token permanente") && ready;
ready =
  check("WHATSAPP_PHONE_NUMBER_ID", phoneNumberId, "falta el id del número emisor") &&
  ready;
ready = check("WHATSAPP_ALERT_TO", to, "falta el número destino") && ready;
console.log(`  · Graph ${version} · idioma ${lang} · plantilla ${tplAlerta}`);

if (!ready) {
  console.log("\nCompleta .env.local y vuelve a correrlo.\n");
  process.exit(1);
}

async function graph(path, init) {
  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

// 1. ¿El token sirve y el número existe?
console.log("\nVerificando el número emisor…");
const info = await graph(
  `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
);
if (!info.ok) {
  console.error(`  ✗ ${info.json?.error?.message ?? `HTTP ${info.status}`}`);
  console.error("    Revisa el token (¿caducó?) y el Phone number ID.\n");
  process.exit(1);
}
console.log(
  `  ✓ ${info.json.verified_name ?? "(sin nombre)"} — ${info.json.display_phone_number}` +
    (info.json.quality_rating ? ` · calidad ${info.json.quality_rating}` : ""),
);

// 2. ¿Están aprobadas las plantillas?
console.log("\nPlantillas de la cuenta:");
const waba = await graph(`${phoneNumberId}?fields=whatsapp_business_account`);
const wabaId = waba.json?.whatsapp_business_account?.id;
if (!wabaId) {
  console.log("  (no se pudo leer la WABA; revisa permisos del token)");
} else {
  const tpls = await graph(
    `${wabaId}/message_templates?fields=name,status,language,category&limit=50`,
  );
  const list = tpls.json?.data ?? [];
  if (list.length === 0) console.log("  (ninguna todavía)");
  for (const t of list) {
    const mark = t.status === "APPROVED" ? "✓" : "…";
    console.log(`  ${mark} ${t.name} · ${t.language} · ${t.category} · ${t.status}`);
  }
  if (!list.some((t) => t.name === tplAlerta && t.status === "APPROVED")) {
    console.log(`\n  ⚠ La plantilla "${tplAlerta}" aún no está aprobada.`);
  }
}

// 3. Envío real, solo si se pide.
if (wants("--alerta")) {
  console.log("\nEnviando plantilla de alerta…");
  const res = await graph(`${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: tplAlerta,
        language: { code: lang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "260729-0001" },
              { type: "text", text: "A domicilio" },
              { type: "text", text: "Prueba" },
              { type: "text", text: "MXN 199.00" },
            ],
          },
        ],
      },
    }),
  });
  console.log(
    res.ok
      ? `  ✓ enviado (${res.json.messages?.[0]?.id})`
      : `  ✗ ${res.json?.error?.message ?? `HTTP ${res.status}`}`,
  );
}

const textIndex = args.indexOf("--texto");
if (textIndex !== -1) {
  const body = args[textIndex + 1] ?? "Prueba de Burger Point";
  console.log("\nEnviando texto libre…");
  const res = await graph(`${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  console.log(
    res.ok
      ? `  ✓ enviado (${res.json.messages?.[0]?.id})`
      : `  ✗ ${res.json?.error?.message ?? `HTTP ${res.status}`}` +
          "\n    Si dice que está fuera de la ventana, es lo esperado: el texto" +
          "\n    libre solo llega si ese número te escribió en las últimas 24 h.",
  );
}

console.log("");
