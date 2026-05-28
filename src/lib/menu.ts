import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SAMPLE_MENU } from "@/lib/sample-menu";
import type { Category, MenuCategory, Product } from "@/lib/types";

/**
 * Devuelve el menú agrupado por categoría (solo activas/disponibles).
 * Si Supabase no está configurado, devuelve el menú de ejemplo para preview.
 */
export async function getMenu(): Promise<MenuCategory[]> {
  if (!isSupabaseConfigured()) {
    return SAMPLE_MENU;
  }

  const supabase = await createClient();

  const [{ data: categories, error: catErr }, { data: products, error: prodErr }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("products")
        .select("*")
        .eq("available", true)
        .order("sort_order"),
    ]);

  if (catErr || prodErr || !categories) {
    return [];
  }

  const byCategory = new Map<string, Product[]>();
  for (const product of (products ?? []) as Product[]) {
    if (!product.category_id) continue;
    // Oculta productos que rastrean inventario y están sin existencias.
    if (product.track_stock && product.stock <= 0) continue;
    const list = byCategory.get(product.category_id) ?? [];
    list.push(product);
    byCategory.set(product.category_id, list);
  }

  return (categories as Category[])
    .map((category) => ({
      ...category,
      products: byCategory.get(category.id) ?? [],
    }))
    .filter((category) => category.products.length > 0);
}
