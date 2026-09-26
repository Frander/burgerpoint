"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  confirmTransferPayment,
  markConversationRead,
  replyToContact,
  toggleBot,
} from "@/app/admin/whatsapp/actions";
import { formatMoney } from "@/lib/format";
import { ORDER_TYPE_META, orderStatusLabel } from "@/lib/orders";
import type { WaContact, WaContactOrder, WaMessage } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Enviando…",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  received: "Recibido",
  failed: "Falló",
};

/** "52999..." -> "+52 999 123 4567" (aproximado, solo para lectura). */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return `+${digits}`;
  const local = digits.slice(-10);
  const lada = digits.slice(0, digits.length - 10);
  return `+${lada} ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Merida",
  });
}

const MEDIA_LABEL: Record<string, string> = {
  image: "📷 Foto",
  sticker: "Sticker",
  audio: "🎤 Audio",
  video: "🎬 Video",
  document: "📄 Archivo",
};

/** Foto, audio, video o archivo del cliente, servido por /api/whatsapp/media. */
function Adjunto({ m }: { m: WaMessage }) {
  const media = m.payload?.media;
  const kind = m.kind ?? "";
  if (!media) {
    // Llegó antes de que se guardara el id del adjunto: ya no se puede bajar.
    return MEDIA_LABEL[kind] ? (
      <p className="italic opacity-60">{MEDIA_LABEL[kind]} (no disponible)</p>
    ) : null;
  }

  const src = `/api/whatsapp/media/${m.id}`;
  if (kind === "image" || kind === "sticker") {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- viene de una ruta privada, no de un dominio fijo */}
        <img
          src={src}
          alt={MEDIA_LABEL[kind]}
          loading="lazy"
          className={`rounded-lg ${kind === "sticker" ? "w-32" : "max-h-80 w-full object-contain"}`}
        />
      </a>
    );
  }
  if (kind === "audio") {
    return <audio controls preload="none" src={src} className="mb-1 max-w-full" />;
  }
  if (kind === "video") {
    return <video controls preload="metadata" src={src} className="mb-1 max-h-80 rounded-lg" />;
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="mb-1 block underline">
      📄 {media.filename ?? "Abrir archivo"}
    </a>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Merida",
  });
}

function relativeSince(iso: string | null): string {
  if (!iso) return "";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} d`;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** ¿Se le puede escribir texto libre? Solo dentro de las 24 h de su último mensaje. */
function windowOpen(contact: WaContact | null): boolean {
  if (!contact?.last_inbound_at || contact.opted_out) return false;
  return Date.now() - new Date(contact.last_inbound_at).getTime() < WINDOW_MS;
}

/** El cliente escribió después de la última vez que alguien abrió el chat. */
function isUnread(c: WaContact): boolean {
  if (!c.last_inbound_at) return false;
  return !c.last_read_at || c.last_inbound_at > c.last_read_at;
}

export default function WhatsappInbox({
  initialContacts,
  initialMessages,
  orders,
  selectedPhone,
  botPausedUntil,
}: {
  initialContacts: WaContact[];
  initialMessages: WaMessage[];
  orders: WaContactOrder[];
  selectedPhone: string | null;
  botPausedUntil: string | null;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<WaContact[]>(initialContacts);
  const [messages, setMessages] = useState<WaMessage[]>(initialMessages);
  const [live, setLive] = useState(false);
  const [soloSinLeer, setSoloSinLeer] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Al cambiar de conversación se limpia lo que se estaba escribiendo.
  const [draftPhone, setDraftPhone] = useState(selectedPhone);
  if (draftPhone !== selectedPhone) {
    setDraftPhone(selectedPhone);
    setDraft("");
    setError(null);
  }

  function send() {
    const text = draft.trim();
    if (!selectedPhone || !text || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await replyToContact(selectedPhone, text);
      if (res.ok) setDraft("");
      else setError(res.error ?? "No se pudo enviar.");
      // Aunque Meta rechace el envío, el bot ya quedó en pausa: hay que verlo.
      router.refresh();
    });
  }

  function setPaused(paused: boolean) {
    if (!selectedPhone) return;
    setError(null);
    startTransition(async () => {
      const res = await toggleBot(selectedPhone, paused);
      if (res.ok) router.refresh();
      else setError(res.error ?? "No se pudo cambiar el bot.");
    });
  }

  function confirmarPago(order: WaContactOrder) {
    if (
      !confirm(
        `¿Ya verificaste la transferencia de ${formatMoney(Number(order.total))} del pedido ${order.code}?\n\nSe marca pagado y se le avisa al cliente por WhatsApp.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await confirmTransferPayment(order.id);
      if (res.ok) router.refresh();
      else setError(res.error ?? "No se pudo registrar el pago.");
    });
  }

  // Abrir la conversación la da por leída (para todo el staff).
  useEffect(() => {
    if (selectedPhone) void markConversationRead(selectedPhone);
  }, [selectedPhone]);

  // El servidor ya trae los mensajes correctos al cambiar ?phone=; solo hay
  // que sincronizar el estado local cuando cambia la selección.
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, selectedPhone]);

  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Contactos: reordena/agrega en vivo cuando alguien escribe.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("wa-contacts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_contacts" },
        (payload) => {
          const row = payload.new as WaContact | undefined;
          if (!row?.phone) return;
          setContacts((prev) => {
            const rest = prev.filter((c) => c.phone !== row.phone);
            return [row, ...rest].sort((a, b) =>
              (b.last_inbound_at ?? "").localeCompare(a.last_inbound_at ?? ""),
            );
          });
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Mensajes de la conversación abierta: entrantes nuevos y cambios de estado
  // (sent -> delivered -> read) del lado saliente.
  useEffect(() => {
    if (!selectedPhone) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`wa-messages-${selectedPhone}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wa_messages",
          filter: `phone=eq.${selectedPhone}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as WaMessage;
            setMessages((prev) =>
              prev.some((m) => m.id === row.id) ? prev : [...prev, row],
            );
            // Lo está viendo: no tiene por qué quedar pendiente.
            if (row.direction === "in") void markConversationRead(selectedPhone);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as WaMessage;
            setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPhone]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.phone === selectedPhone) ?? null,
    [contacts, selectedPhone],
  );
  const canWrite = windowOpen(selectedContact);
  // La que está abierta nunca cuenta como pendiente, aunque el aviso de "leído"
  // tarde un instante en volver por realtime.
  const pendiente = (c: WaContact) => c.phone !== selectedPhone && isUnread(c);
  const sinLeer = contacts.filter(pendiente).length;
  const visibles = soloSinLeer ? contacts.filter(pendiente) : contacts;

  useEffect(() => {
    document.title = sinLeer > 0 ? `(${sinLeer}) WhatsApp` : "WhatsApp";
  }, [sinLeer]);
  const botPaused = botPausedUntil !== null;

  return (
    <div className="flex h-[calc(100vh-4rem)] max-h-[900px] gap-4">
      {/* Lista de conversaciones */}
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between border-b border-black/10 px-3 py-2 dark:border-white/10">
          <h1 className="text-sm font-bold">WhatsApp</h1>
          <span
            className={`flex items-center gap-1 text-[11px] ${
              live ? "text-green-600" : "text-black/40 dark:text-white/40"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? "bg-green-600" : "bg-black/30 dark:bg-white/30"}`}
            />
            {live ? "En vivo" : "Conectando…"}
          </span>
        </div>
        <div className="flex gap-1 border-b border-black/10 px-2 py-1.5 text-xs dark:border-white/10">
          {[
            { value: false, label: "Todas" },
            { value: true, label: `Sin leer${sinLeer > 0 ? ` (${sinLeer})` : ""}` },
          ].map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setSoloSinLeer(f.value)}
              className={`rounded-full px-2.5 py-1 font-medium ${
                soloSinLeer === f.value
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {visibles.length === 0 && (
            <p className="p-4 text-center text-xs text-black/40 dark:text-white/40">
              {soloSinLeer ? "No hay mensajes pendientes. 🎉" : "Todavía no hay conversaciones."}
            </p>
          )}
          {visibles.map((c) => {
            const active = c.phone === selectedPhone;
            const unread = pendiente(c);
            return (
              <button
                key={c.phone}
                onClick={() => router.push(`/admin/whatsapp?phone=${c.phone}`)}
                className={`flex w-full flex-col gap-0.5 border-b border-black/5 px-3 py-2.5 text-left text-sm hover:bg-black/5 dark:border-white/5 dark:hover:bg-white/5 ${
                  active ? "bg-black/[.06] dark:bg-white/10" : ""
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={`truncate ${unread ? "font-bold" : "font-medium"}`}>
                    {c.name || formatPhone(c.phone)}
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1.5 text-[11px] ${
                      unread ? "font-semibold text-green-600" : "text-black/40 dark:text-white/40"
                    }`}
                  >
                    {relativeSince(c.last_inbound_at)}
                    {unread && (
                      <span className="h-2.5 w-2.5 rounded-full bg-green-600" aria-label="Sin leer" />
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
                  {c.name ? formatPhone(c.phone) : " "}
                  {c.opted_out && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      Baja
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Hilo de mensajes */}
      <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        {!selectedPhone && (
          <div className="flex flex-1 items-center justify-center text-sm text-black/40 dark:text-white/40">
            Elige una conversación de la izquierda.
          </div>
        )}

        {selectedPhone && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {selectedContact?.name || formatPhone(selectedPhone)}
                </p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  {formatPhone(selectedPhone)}
                  {selectedContact?.opted_out && " · dado de baja (no recibe avisos)"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    botPaused
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                      : "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
                  }`}
                  title={
                    botPaused
                      ? `Vuelve solo a las ${formatTime(botPausedUntil!)} si nadie escribe`
                      : undefined
                  }
                >
                  {botPaused ? "Atiendes tú · bot en pausa" : "Bot activo"}
                </span>
                <button
                  type="button"
                  onClick={() => setPaused(!botPaused)}
                  disabled={pending}
                  className="rounded-lg border border-black/15 px-2.5 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
                >
                  {botPaused ? "Reactivar bot" : "Pausar bot"}
                </button>
              </div>
            </div>

            {orders.length > 0 && (
              <div className="flex flex-col gap-1.5 border-b border-black/10 px-4 py-2 dark:border-white/10">
                {orders.map((o) => {
                  const pagado = o.payment_status === "pagado";
                  return (
                    <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-bold">{o.code}</span>
                      <span className="text-black/60 dark:text-white/60">
                        {ORDER_TYPE_META[o.type]?.label ?? o.type} ·{" "}
                        {orderStatusLabel(o.status, o.type)} · {formatMoney(Number(o.total))}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          pagado
                            ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                        }`}
                      >
                        {pagado ? "Pagado" : "No pagado"}
                      </span>
                      {!pagado && (
                        <button
                          type="button"
                          onClick={() => confirmarPago(o)}
                          disabled={pending}
                          className="ml-auto rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          ✓ Confirmar pago por transferencia
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1 space-y-2 overflow-y-auto bg-black/[.015] p-4 dark:bg-white/[.02]">
              {messages.length === 0 && (
                <p className="text-center text-xs text-black/40 dark:text-white/40">
                  Sin mensajes todavía.
                </p>
              )}
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const showDay =
                  !prev || formatDay(prev.created_at) !== formatDay(m.created_at);
                const out = m.direction === "out";
                return (
                  <div key={m.id}>
                    {showDay && (
                      <p className="my-3 text-center text-[11px] text-black/40 dark:text-white/40">
                        {formatDay(m.created_at)}
                      </p>
                    )}
                    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          out
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "border border-black/10 bg-white dark:border-white/10 dark:bg-black"
                        }`}
                      >
                        {m.template_name && (
                          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide opacity-60">
                            Plantilla: {m.template_name}
                          </p>
                        )}
                        {m.dedupe_tag === "manual" && (
                          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide opacity-60">
                            Escrito a mano
                          </p>
                        )}
                        <Adjunto m={m} />
                        {(m.body || !MEDIA_LABEL[m.kind ?? ""]) && (
                          <p className="whitespace-pre-wrap">{m.body || "(sin texto)"}</p>
                        )}
                        <p
                          className={`mt-1 text-right text-[10px] ${
                            out ? "opacity-60" : "text-black/40 dark:text-white/40"
                          }`}
                        >
                          {formatTime(m.created_at)}
                          {out && m.status && ` · ${STATUS_LABEL[m.status] ?? m.status}`}
                        </p>
                        {m.error && (
                          <p className="mt-1 text-[10px] text-red-400">{m.error}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Respuesta a mano */}
            <div className="border-t border-black/10 p-3 dark:border-white/10">
              {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
              {canWrite ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                  className="flex items-end gap-2"
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter manda; Shift+Enter hace salto de línea, como en WhatsApp Web.
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    maxLength={4096}
                    placeholder={
                      botPaused
                        ? "Escribe tu respuesta…"
                        : "Escribe tu respuesta… (al enviar, el bot se pausa en este chat)"
                    }
                    className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
                  />
                  <button
                    type="submit"
                    disabled={pending || !draft.trim()}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
                  >
                    {pending ? "Enviando…" : "Enviar"}
                  </button>
                </form>
              ) : (
                <p className="text-center text-xs text-black/50 dark:text-white/50">
                  {selectedContact?.opted_out
                    ? "Pidió la baja: no se le puede escribir hasta que vuelva a escribir él."
                    : "Pasaron más de 24 h desde su último mensaje. WhatsApp solo deja contestarle cuando vuelva a escribir."}
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
