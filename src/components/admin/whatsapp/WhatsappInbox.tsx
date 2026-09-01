"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { WaContact, WaMessage } from "@/lib/types";

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

export default function WhatsappInbox({
  initialContacts,
  initialMessages,
  selectedPhone,
}: {
  initialContacts: WaContact[];
  initialMessages: WaMessage[];
  selectedPhone: string | null;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<WaContact[]>(initialContacts);
  const [messages, setMessages] = useState<WaMessage[]>(initialMessages);
  const [live, setLive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0 && (
            <p className="p-4 text-center text-xs text-black/40 dark:text-white/40">
              Todavía no hay conversaciones.
            </p>
          )}
          {contacts.map((c) => {
            const active = c.phone === selectedPhone;
            return (
              <button
                key={c.phone}
                onClick={() => router.push(`/admin/whatsapp?phone=${c.phone}`)}
                className={`flex w-full flex-col gap-0.5 border-b border-black/5 px-3 py-2.5 text-left text-sm hover:bg-black/5 dark:border-white/5 dark:hover:bg-white/5 ${
                  active ? "bg-black/[.06] dark:bg-white/10" : ""
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {c.name || formatPhone(c.phone)}
                  </span>
                  <span className="shrink-0 text-[11px] text-black/40 dark:text-white/40">
                    {relativeSince(c.last_inbound_at)}
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
            <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
              <p className="text-sm font-bold">
                {selectedContact?.name || formatPhone(selectedPhone)}
              </p>
              <p className="text-xs text-black/50 dark:text-white/50">
                {formatPhone(selectedPhone)}
                {selectedContact?.opted_out && " · dado de baja (no recibe avisos)"}
              </p>
            </div>

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
                        <p className="whitespace-pre-wrap">{m.body || "(sin texto)"}</p>
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
          </>
        )}
      </section>
    </div>
  );
}
