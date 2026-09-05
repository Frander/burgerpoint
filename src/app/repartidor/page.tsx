import { createClient } from "@/lib/supabase/server";
import { requireSection } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { inicioDelDia } from "@/lib/format";
import type { OrderWithItems } from "@/lib/types";
import DeliveryBoard from "@/components/repartidor/DeliveryBoard";

export const dynamic = "force-dynamic";

export default async function RepartidorPage() {
  const profile = await requireSection("entregas");

  if (!isSupabaseConfigured()) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        Conecta Supabase para ver tus entregas.
      </p>
    );
  }

  const supabase = await createClient();
  // Las políticas RLS ya limitan al repartidor a sus propios pedidos; el filtro
  // por courier_id está aquí para que un admin que abra esta pantalla no vea
  // los pedidos de todos.
  // Pendientes (todas) + las que ya entregó hoy, para que vea su avance.
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*, order_item_modifiers(*))")
    .eq("courier_id", profile.id)
    .or(`status.eq.listo,and(status.eq.entregado,closed_at.gte.${inicioDelDia()})`)
    .order("assigned_at", { ascending: true, nullsFirst: false })
    .limit(50);

  return (
    <DeliveryBoard
      courierId={profile.id}
      initialOrders={(data ?? []) as OrderWithItems[]}
    />
  );
}
