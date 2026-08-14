import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SAMPLE_MENU, SAMPLE_MODIFIER_GROUPS } from "@/lib/sample-menu";
import { isSoldOut } from "@/lib/product";
import type {
  Category,
  MenuCategory,
  ModifierGroupWithOptions,
  Product,
  ProductWithModifiers,
} from "@/lib/types";

/**
 * Devuelve el menú agrupado por las categorías activas. Los productos agotados
 * se incluyen marcados con `sold_out` para que la vista los muestre apagados.
 * Si Supabase no está configurado, devuelve el menú de ejemplo para preview.
 */
export async function getMenu(): Promise<MenuCategory[]> {
  if (!isSupabaseConfigured()) {
    // Marca los productos de ejemplo que tienen opciones.
    return SAMPLE_MENU.map((cat) => ({
      ...cat,
      products: cat.products.map((p) => ({
        ...p,
        has_modifiers: Boolean(SAMPLE_MODIFIER_GROUPS[p.id]?.length),
      })),
    }));
  }

  const supabase = await createClient();

  const [{ data: categories, error: catErr }, { data: products, error: prodErr }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("active", true)
        .order("sort_order"),
      supabase.from("products").select("*").order("sort_order"),
    ]);

  if (catErr || prodErr || !categories) {
    return [];
  }

  // Qué productos tienen grupos de opciones (para enlazar al detalle).
  const all = (products ?? []) as Product[];
  const withModifiers = new Set<string>();
  if (all.length > 0) {
    const { data: groups } = await supabase
      .from("modifier_groups")
      .select("product_id")
      .in(
        "product_id",
        all.map((p) => p.id),
      );
    for (const g of (groups ?? []) as { product_id: string }[]) {
      withModifiers.add(g.product_id);
    }
  }

  const byCategory = new Map<string, Product[]>();
  for (const product of all) {
    if (!product.category_id) continue;
    // Los agotados siguen en el menú, marcados: que desaparezcan confunde al
    // cliente (parece que ya no existe) y al staff en el PDV.
    const list = byCategory.get(product.category_id) ?? [];
    list.push({
      ...product,
      has_modifiers: withModifiers.has(product.id),
      sold_out: isSoldOut(product),
    });
    byCategory.set(product.category_id, list);
  }

  return (categories as Category[])
    .map((category) => ({
      ...category,
      products: byCategory.get(category.id) ?? [],
    }))
    .filter((category) => category.products.length > 0);
}

/**
 * Devuelve un producto con sus grupos de opciones (para la página de detalle).
 * `null` solo si no existe: los agotados se devuelven marcados con `sold_out`
 * para poder mostrarlos sin permitir el pedido. En modo preview usa el menú de
 * ejemplo y sus grupos de opciones de muestra.
 */
export async function getProduct(
  id: string,
): Promise<ProductWithModifiers | null> {
  if (!isSupabaseConfigured()) {
    const product = SAMPLE_MENU.flatMap((c) => c.products).find(
      (p) => p.id === id,
    );
    if (!product) return null;
    return { ...product, modifier_groups: SAMPLE_MODIFIER_GROUPS[id] ?? [] };
  }

  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !product) return null;

  const { data: groups } = await supabase
    .from("modifier_groups")
    .select("*, modifiers(*)")
    .eq("product_id", id)
    .order("sort_order");

  const modifier_groups = ((groups ?? []) as ModifierGroupWithOptions[])
    .map((g) => ({
      ...g,
      modifiers: [...(g.modifiers ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    ...(product as Product),
    sold_out: isSoldOut(product as Product),
    modifier_groups,
  };
}
