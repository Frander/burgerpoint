import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Category, Product } from "@/lib/types";
import CategoryManager from "@/components/admin/CategoryManager";
import ProductManager from "@/components/admin/ProductManager";

export const dynamic = "force-dynamic";

export default async function MenuAdminPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Menú</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase (en <code>.env.local</code>) para gestionar el menú.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("products").select("*").order("sort_order"),
  ]);

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Menú</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Administra las categorías y productos que ven tus clientes.
        </p>
      </div>

      <CategoryManager categories={(categories ?? []) as Category[]} />
      <ProductManager
        products={(products ?? []) as Product[]}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
