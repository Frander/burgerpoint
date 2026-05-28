import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { OrderWithItems } from "@/lib/types";
import OrderList from "@/components/admin/OrderList";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase para ver los pedidos.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Pedidos</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Los 100 pedidos más recientes.
      </p>
      <div className="mt-6">
        <OrderList orders={(orders ?? []) as OrderWithItems[]} />
      </div>
    </div>
  );
}
