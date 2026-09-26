import { createClient } from "@/lib/supabase/server";
import { requireSection } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { WaContact, WaContactOrder, WaMessage } from "@/lib/types";
import WhatsappInbox from "@/components/admin/whatsapp/WhatsappInbox";

export const dynamic = "force-dynamic";

/** La pausa del bot vence a las 6 h sin mensajes (wa_prune_sessions, 0009). */
function pausedUntil(sesion: { state: string; updated_at: string } | null): string | null {
  if (sesion?.state !== "humano") return null;
  const until = new Date(sesion.updated_at).getTime() + 6 * 60 * 60 * 1000;
  return until > Date.now() ? new Date(until).toISOString() : null;
}

function haceDias(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

export default async function WhatsappPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  await requireSection("whatsapp");
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">WhatsApp</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase para ver las conversaciones.
        </p>
      </div>
    );
  }

  const { phone: selectedPhone } = await searchParams;
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("wa_contacts")
    .select("*")
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .limit(200);

  let messages: WaMessage[] = [];
  let orders: WaContactOrder[] = [];
  // Hasta cuándo sigue callado el bot en esta conversación (null = activo).
  let botPausedUntil: string | null = null;
  if (selectedPhone) {
    // Pedidos de los últimos 3 días de este cliente. Los del bot guardan el
    // teléfono normalizado; los de la web, como lo escribió el cliente, así que
    // se busca también por los 10 dígitos locales (igual que el comando
    // "estado" del bot).
    // Solo dígitos: el valor viene de la URL y va dentro del filtro .or().
    const tel = selectedPhone.replace(/\D/g, "");
    const local = tel.slice(-10);
    const [{ data }, { data: sesion }, { data: pedidos }] = await Promise.all([
      supabase
        .from("wa_messages")
        .select("*")
        .eq("phone", selectedPhone)
        .order("created_at", { ascending: true })
        .limit(300),
      supabase
        .from("wa_sessions")
        .select("state, updated_at")
        .eq("phone", selectedPhone)
        .maybeSingle(),
      // Sin un número real, "%%" traería los pedidos de todo mundo.
      local.length < 8
        ? Promise.resolve({ data: [] })
        : supabase
            .from("orders")
            .select("id, code, type, status, total, payment_status, created_at")
            .or(`customer_phone.eq.${tel},customer_phone.ilike.%${local}%`)
            .neq("status", "cancelado")
            .gte("created_at", haceDias(3))
            .order("created_at", { ascending: false })
            .limit(5),
    ]);
    orders = (pedidos ?? []) as WaContactOrder[];
    messages = (data ?? []) as WaMessage[];
    botPausedUntil = pausedUntil(sesion as { state: string; updated_at: string } | null);
  }

  return (
    <WhatsappInbox
      initialContacts={(contacts ?? []) as WaContact[]}
      initialMessages={messages}
      orders={orders}
      selectedPhone={selectedPhone ?? null}
      botPausedUntil={botPausedUntil}
    />
  );
}
