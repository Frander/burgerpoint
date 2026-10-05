import { createClient } from "@/lib/supabase/server";
import { requireSection } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  Category,
  Meat,
  MeatDailyMove,
  MeatEntry,
  Product,
  ProductMeat,
} from "@/lib/types";
import { ahoraEnYucatan } from "@/lib/hours";
import InventoryManager from "@/components/admin/InventoryManager";
import MeatManager from "@/components/admin/MeatManager";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  await requireSection("inventario");
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
  const [
    { data: products },
    { data: categories },
    meatsRes,
    { data: productMeats },
    { data: entradas },
    { data: historial },
  ] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("meats").select("*").order("sort_order"),
      supabase.from("product_meats").select("*"),
      // Las últimas entradas: de aquí sale la más reciente de cada carne.
      supabase
        .from("meat_moves")
        .select("id, meat_id, quantity, moved_on, stock_after, created_at")
        .eq("type", "entrada")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("meat_moves_daily")
        .select("*")
        .order("moved_on", { ascending: false })
        .limit(30),
    ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Inventario</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Activa el rastreo de los productos que quieras controlar. Al vender se
        descuenta solo; los productos sin existencias se ocultan del menú.
      </p>
      {meatsRes.error ? (
        // Sin la migración 0018 el resto del inventario sigue funcionando.
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Para llevar el control de carnes falta aplicar la migración{" "}
          <code>0018_carnes.sql</code>.
        </p>
      ) : (
        <div className="mt-6">
          <MeatManager
            meats={(meatsRes.data ?? []) as Meat[]}
            productMeats={(productMeats ?? []) as ProductMeat[]}
            entradas={(entradas ?? []) as MeatEntry[]}
            historial={(historial ?? []) as MeatDailyMove[]}
            products={(products ?? []) as Product[]}
            categories={(categories ?? []) as Category[]}
            hoy={ahoraEnYucatan().fecha}
          />
        </div>
      )}

      <h2 className="mt-10 text-xl font-bold">Productos</h2>
      <div className="mt-4">
        <InventoryManager products={(products ?? []) as Product[]} />
      </div>
    </div>
  );
}
