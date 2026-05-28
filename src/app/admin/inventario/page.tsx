import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Product } from "@/lib/types";
import InventoryManager from "@/components/admin/InventoryManager";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Inventario</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase para gestionar el inventario.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("name");

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Inventario</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Activa el rastreo de los productos que quieras controlar. Al vender se
        descuenta solo; los productos sin existencias se ocultan del menú.
      </p>
      <div className="mt-6">
        <InventoryManager products={(products ?? []) as Product[]} />
      </div>
    </div>
  );
}
