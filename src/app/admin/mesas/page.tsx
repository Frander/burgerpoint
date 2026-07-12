import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { SalaWithMesas } from "@/lib/types";
import MesaManager from "@/components/admin/MesaManager";

export const dynamic = "force-dynamic";

export default async function MesasPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Salas y mesas</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase para gestionar las mesas.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: salas } = await supabase
    .from("salas")
    .select("*, mesas(*)")
    .order("sort_order");

  const ordered = ((salas ?? []) as SalaWithMesas[]).map((s) => ({
    ...s,
    mesas: [...(s.mesas ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Salas y mesas</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Organiza el restaurante en salas y sus mesas; el PDV las usa para los
        pedidos en mesa.
      </p>
      <div className="mt-6">
        <MesaManager salas={ordered} />
      </div>
    </div>
  );
}
