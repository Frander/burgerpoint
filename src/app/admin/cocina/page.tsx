import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { OrderWithItems } from "@/lib/types";
import KitchenBoard from "@/components/admin/KitchenBoard";

export const dynamic = "force-dynamic";

const ACTIVE = ["nuevo", "en_cocina", "listo"];

export default async function CocinaPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Cocina</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase para usar la pantalla de cocina.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .in("status", ACTIVE)
    .order("created_at", { ascending: true });

  return <KitchenBoard initialOrders={(orders ?? []) as OrderWithItems[]} />;
}
