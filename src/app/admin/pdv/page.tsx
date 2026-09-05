import { createClient } from "@/lib/supabase/server";
import { requireSection } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMenu } from "@/lib/menu";
import { getCouriers } from "@/lib/couriers";
import type { OrderFull, SalaWithMesas } from "@/lib/types";
import PdvBoard from "@/components/admin/pdv/PdvBoard";

export const dynamic = "force-dynamic";

export default async function PdvPage() {
  await requireSection("pdv");
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">PDV</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase para usar el punto de venta.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const [menu, couriers, { data: orders }, { data: salas }] = await Promise.all([
    getMenu(),
    getCouriers(),
    supabase
      .from("orders")
      .select("*, order_items(*, order_item_modifiers(*)), order_payments(*)")
      .in("status", ["nuevo", "en_cocina", "listo"])
      .order("created_at", { ascending: true }),
    supabase
      .from("salas")
      .select("*, mesas(*)")
      .eq("active", true)
      .order("sort_order"),
  ]);

  const salasOrdenadas = ((salas ?? []) as SalaWithMesas[]).map((s) => ({
    ...s,
    mesas: [...(s.mesas ?? [])]
      .filter((m) => m.active)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  return (
    <PdvBoard
      menu={menu}
      salas={salasOrdenadas}
      couriers={couriers}
      initialOrders={(orders ?? []) as OrderFull[]}
    />
  );
}
