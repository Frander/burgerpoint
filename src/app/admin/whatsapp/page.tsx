import { createClient } from "@/lib/supabase/server";
import { requireSection } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { WaContact, WaMessage } from "@/lib/types";
import WhatsappInbox from "@/components/admin/whatsapp/WhatsappInbox";

export const dynamic = "force-dynamic";

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
  if (selectedPhone) {
    const { data } = await supabase
      .from("wa_messages")
      .select("*")
      .eq("phone", selectedPhone)
      .order("created_at", { ascending: true })
      .limit(300);
    messages = (data ?? []) as WaMessage[];
  }

  return (
    <WhatsappInbox
      initialContacts={(contacts ?? []) as WaContact[]}
      initialMessages={messages}
      selectedPhone={selectedPhone ?? null}
    />
  );
}
