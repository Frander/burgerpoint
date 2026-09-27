import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSoldOut } from "@/lib/product";
import type {
  Category,
  Modifier,
  ModifierGroupWithOptions,
  Product,
} from "@/lib/types";

/**
 * Lectura del menú para el bot.
 *
 * Usa la service_role en vez de `getMenu()`/`getProduct()` porque aquí no hay
 * petición del navegador ni cookies: el webhook contesta a Meta y sigue
 * trabajando en segundo plano, donde el cliente de servidor basado en cookies
 * ya no aplica.
 */

export interface BotCategory {
  id: string;
  name: string;
}

export interface BotProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sold_out: boolean;
  has_modifiers: boolean;
}

/** Categorías activas que tienen al menos un producto pedible. */
export async function listCategories(): Promise<BotCategory[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").eq("active", true).order("sort_order"),
    supabase.from("products").select("*"),
  ]);

  const pedibles = new Set(
    ((products ?? []) as Product[])
      .filter((p) => !isSoldOut(p) && p.category_id)
      .map((p) => p.category_id as string),
  );

  return ((categories ?? []) as Category[])
    .filter((c) => pedibles.has(c.id))
    .map((c) => ({ id: c.id, name: c.name }));
}

/**
 * Productos de una categoría. Los agotados se omiten: en el menú web se
 * muestran apagados porque ahí se ven, pero en una lista numerada por WhatsApp
 * solo estorban (el cliente no puede "ver" que están grises).
 */
export async function listProducts(categoryId: string): Promise<BotProduct[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("category_id", categoryId)
    .order("sort_order");

  const rows = ((products ?? []) as Product[]).filter((p) => !isSoldOut(p));
  if (rows.length === 0) return [];

  const { data: groups } = await supabase
    .from("modifier_groups")
    .select("product_id")
    .in(
      "product_id",
      rows.map((p) => p.id),
    );

  const conOpciones = new Set(
    ((groups ?? []) as { product_id: string }[]).map((g) => g.product_id),
  );

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    sold_out: false,
    has_modifiers: conOpciones.has(p.id),
  }));
}

/** Un producto con sus grupos de opciones ordenados, o null si no es pedible. */
export async function getBotProduct(
  productId: string,
): Promise<{ product: BotProduct; groups: ModifierGroupWithOptions[] } | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  const product = data as Product | null;
  if (!product || isSoldOut(product)) return null;

  const { data: groups } = await supabase
    .from("modifier_groups")
    .select("*, modifiers(*)")
    .eq("product_id", productId)
    .order("sort_order");

  const ordenados = ((groups ?? []) as ModifierGroupWithOptions[])
    .map((g) => ({
      ...g,
      modifiers: [...(g.modifiers ?? [])].sort(
        (a: Modifier, b: Modifier) => a.sort_order - b.sort_order,
      ),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      sold_out: false,
      has_modifiers: ordenados.length > 0,
    },
    groups: ordenados,
  };
}

/** Busca por nombre, para cuando el cliente escribe "hamburguesa" en vez de un número. */
export async function searchProducts(term: string): Promise<BotProduct[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  const limpio = term.replace(/[%_,]/g, " ").trim();
  if (limpio.length < 3) return [];

  const { data } = await supabase
    .from("products")
    .select("*")
    .ilike("name", `%${limpio}%`)
    .order("sort_order")
    .limit(15);

  const rows = ((data ?? []) as Product[]).filter((p) => !isSoldOut(p));
  if (rows.length === 0) return [];

  const { data: groups } = await supabase
    .from("modifier_groups")
    .select("product_id")
    .in(
      "product_id",
      rows.map((p) => p.id),
    );
  const conOpciones = new Set(
    ((groups ?? []) as { product_id: string }[]).map((g) => g.product_id),
  );

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    sold_out: false,
    has_modifiers: conOpciones.has(p.id),
  }));
}

export interface MenuSnapshot {
  /** "Categoría: Producto $precio, …" por línea, para el prompt de la IA. */
  texto: string;
  /** Nombres pedibles (productos) y de opciones, para validar lo que diga la IA. */
  productos: string[];
  opciones: string[];
}

/**
 * Menú vigente completo en dos consultas. La IA lo recibe en cada turno para
 * que no tenga que adivinar (con solo herramientas llegó a inventar platillos
 * cuando no las llamaba), y el mismo listado sirve para revisar su respuesta.
 */
export async function menuSnapshot(): Promise<MenuSnapshot> {
  const supabase = createAdminClient();
  if (!supabase) return { texto: "", productos: [], opciones: [] };

  const [{ data: categories }, { data: products }, { data: modifiers }] = await Promise.all([
    supabase.from("categories").select("*").eq("active", true).order("sort_order"),
    supabase.from("products").select("*").order("sort_order"),
    supabase.from("modifiers").select("name"),
  ]);

  const pedibles = ((products ?? []) as Product[]).filter((p) => !isSoldOut(p));
  const lineas: string[] = [];
  for (const c of (categories ?? []) as Category[]) {
    const deLaCategoria = pedibles.filter((p) => p.category_id === c.id);
    if (deLaCategoria.length === 0) continue;
    lineas.push(
      `${c.name}: ${deLaCategoria.map((p) => `${p.name} $${Number(p.price)}`).join(", ")}`,
    );
  }

  return {
    texto: lineas.join("\n"),
    productos: pedibles.map((p) => p.name),
    opciones: ((modifiers ?? []) as Pick<Modifier, "name">[]).map((m) => m.name),
  };
}
