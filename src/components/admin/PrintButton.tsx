"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Canal de Realtime que escucha el agente de impresión (print-agent). */
const CANAL = "impresion";
/** Si el agente no confirma en este tiempo, se imprime desde el navegador. */
const ESPERA_MS = 5000;

type Kind = "cliente" | "cocina";

/**
 * Pide al agente de la caja que imprima el pedido en la térmica. Resuelve
 * true cuando el agente confirma que salió; false si no contestó a tiempo
 * (PC de la caja apagada, agente sin la versión nueva) o dio error.
 */
function pedirAlAgente(orderId: string, kind: Kind): Promise<boolean> {
  const supabase = createClient();
  const reqId = crypto.randomUUID();
  const canal = supabase.channel(CANAL);

  return new Promise((resolve) => {
    let listo = false;
    const terminar = (ok: boolean) => {
      if (listo) return;
      listo = true;
      clearTimeout(timer);
      supabase.removeChannel(canal);
      resolve(ok);
    };
    const timer = setTimeout(() => terminar(false), ESPERA_MS);

    canal
      .on("broadcast", { event: "impreso" }, ({ payload }) => {
        if (payload?.reqId === reqId) terminar(payload.ok === true);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          canal.send({
            type: "broadcast",
            event: "reimprimir",
            payload: { reqId, orderId, kind },
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          terminar(false);
        }
      });
  });
}

/** Devuelve false si el navegador bloqueó la ventana emergente. */
function abrirEnNavegador(orderId: string, kind: Kind): boolean {
  return !!window.open(
    `/print/ticket/${orderId}?tipo=${kind}`,
    "_blank",
    "width=420,height=720",
  );
}

/**
 * Botón 🖨: manda el ticket a la impresora de la caja a través del agente, así
 * funciona desde cualquier equipo. Si el agente no responde, cae al diálogo de
 * impresión del navegador como antes.
 */
export default function PrintButton({
  orderId,
  kind,
  label,
  title,
}: {
  orderId: string;
  kind: Kind;
  label: string;
  title: string;
}) {
  // "local": el agente no contestó; el siguiente clic imprime desde aquí.
  const [estado, setEstado] = useState<"" | "enviando" | "ok" | "local">("");

  async function imprimir() {
    if (estado === "local") {
      setEstado("");
      abrirEnNavegador(orderId, kind);
      return;
    }
    setEstado("enviando");
    const ok = await pedirAlAgente(orderId, kind);
    if (ok) {
      setEstado("ok");
      setTimeout(() => setEstado(""), 2500);
      return;
    }
    // Tras esperar al agente el clic ya "caducó" y el navegador puede
    // bloquear la ventana; entonces se pide un segundo clic.
    setEstado(abrirEnNavegador(orderId, kind) ? "" : "local");
  }

  return (
    <button
      type="button"
      title={title}
      disabled={estado === "enviando"}
      onClick={imprimir}
      className="rounded-full border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
    >
      {estado === "enviando"
        ? "🖨 Enviando…"
        : estado === "ok"
          ? "✅ Impreso"
          : estado === "local"
            ? "🖨 Imprimir aquí"
            : label}
    </button>
  );
}
