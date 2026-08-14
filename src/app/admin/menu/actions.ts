"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function revalidateMenu() {
  revalidatePath("/admin/menu");
  revalidatePath("/"); // portada
  revalidatePath("/menu"); // storefront público
}

/**
 * Reescribe `sort_order` según la posición de cada id en el arreglo.
 * Las políticas RLS ya limitan la escritura al staff autenticado.
 */
async function applyOrder(
  table: "categories" | "modifier_groups" | "modifiers",
  ids: string[],
): Promise<string | null> {
  if (ids.length === 0) return null;
  const supabase = await createClient();
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase.from(table).update({ sort_order: index }).eq("id", id),
    ),
  );
  return results.find((result) => result.error)?.error?.message ?? null;
}

// ---------- Categorías ----------

export async function createCategory(
  name: string,
  sortOrder = 0,
): Promise<ActionResult> {
  if (!name.trim()) return { ok: false, error: "El nombre es obligatorio." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .insert({ name: name.trim(), sort_order: sortOrder });
  if (error) return { ok: false, error: error.message };
  revalidateMenu();
  return { ok: true };
}

export async function updateCategory(
  id: string,
  fields: { name?: string; active?: boolean; sort_order?: number },
): Promise<ActionResult> {
  const patch: Record<string, unknown> = { ...fields };
  if (typeof patch.name === "string") {
    patch.name = patch.name.trim();
    if (!patch.name) return { ok: false, error: "El nombre es obligatorio." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateMenu();
  return { ok: true };
}

/** Guarda el orden de las categorías (el que se ve en el menú público). */
export async function reorderCategories(ids: string[]): Promise<ActionResult> {
  const error = await applyOrder("categories", ids);
  if (error) return { ok: false, error };
  revalidateMenu();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateMenu();
  return { ok: true };
}

// ---------- Productos ----------

export interface ProductInput {
  name: string;
  description?: string | null;
  price: number;
  category_id: string | null;
  available?: boolean;
  image_url?: string | null;
}

export async function createProduct(
  input: ProductInput,
): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "El nombre es obligatorio." };
  if (!(input.price >= 0)) return { ok: false, error: "Precio inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    price: input.price,
    category_id: input.category_id,
    available: input.available ?? true,
    image_url: input.image_url ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateMenu();
  return { ok: true };
}

export async function updateProduct(
  id: string,
  fields: Partial<ProductInput>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { ...fields };
  if (typeof patch.name === "string") patch.name = patch.name.trim();
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateMenu();
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateMenu();
  return { ok: true };
}

// ---------- Grupos de opciones / modificadores ----------

function revalidateProduct(productId: string) {
  revalidatePath(`/admin/menu/${productId}`);
  revalidatePath(`/menu/${productId}`);
  revalidateMenu(); // afecta el flag has_modifiers en el listado
}

export interface GroupInput {
  name: string;
  min_select: number;
  max_select: number;
  sort_order?: number;
}

export async function createGroup(
  productId: string,
  input: GroupInput,
): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Falta el nombre del grupo." };
  if (input.max_select < 1) return { ok: false, error: "El máximo debe ser ≥ 1." };
  if (input.min_select < 0 || input.min_select > input.max_select) {
    return { ok: false, error: "El mínimo no puede superar al máximo." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("modifier_groups").insert({
    product_id: productId,
    name: input.name.trim(),
    min_select: input.min_select,
    max_select: input.max_select,
    sort_order: input.sort_order ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  revalidateProduct(productId);
  return { ok: true };
}

export async function updateGroup(
  id: string,
  productId: string,
  fields: Partial<GroupInput>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { ...fields };
  if (typeof patch.name === "string") {
    patch.name = patch.name.trim();
    if (!patch.name) return { ok: false, error: "Falta el nombre del grupo." };
  }
  if (fields.max_select !== undefined && fields.max_select < 1) {
    return { ok: false, error: "El máximo debe ser ≥ 1." };
  }
  if (fields.min_select !== undefined && fields.min_select < 0) {
    return { ok: false, error: "El mínimo no puede ser negativo." };
  }
  const { error } = await supabase
    .from("modifier_groups")
    .update(patch)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateProduct(productId);
  return { ok: true };
}

/** Guarda el orden de los grupos de opciones dentro de un producto. */
export async function reorderGroups(
  productId: string,
  ids: string[],
): Promise<ActionResult> {
  const error = await applyOrder("modifier_groups", ids);
  if (error) return { ok: false, error };
  revalidateProduct(productId);
  return { ok: true };
}

export async function deleteGroup(
  id: string,
  productId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("modifier_groups").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateProduct(productId);
  return { ok: true };
}

export interface ModifierInput {
  name: string;
  extra_price: number;
  sort_order?: number;
}

export async function createModifier(
  groupId: string,
  productId: string,
  input: ModifierInput,
): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Falta el nombre de la opción." };
  if (!(input.extra_price >= 0)) return { ok: false, error: "Precio inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("modifiers").insert({
    group_id: groupId,
    product_id: productId,
    name: input.name.trim(),
    extra_price: input.extra_price,
    sort_order: input.sort_order ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  revalidateProduct(productId);
  return { ok: true };
}

/** Edita una opción existente (nombre y/o precio extra) sin recrearla. */
export async function updateModifier(
  id: string,
  productId: string,
  fields: Partial<ModifierInput>,
): Promise<ActionResult> {
  const patch: Record<string, unknown> = { ...fields };
  if (typeof patch.name === "string") {
    patch.name = patch.name.trim();
    if (!patch.name) return { ok: false, error: "Falta el nombre de la opción." };
  }
  if (fields.extra_price !== undefined && !(fields.extra_price >= 0)) {
    return { ok: false, error: "Precio inválido." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("modifiers").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateProduct(productId);
  return { ok: true };
}

/** Guarda el orden de las opciones dentro de un grupo. */
export async function reorderModifiers(
  productId: string,
  ids: string[],
): Promise<ActionResult> {
  const error = await applyOrder("modifiers", ids);
  if (error) return { ok: false, error };
  revalidateProduct(productId);
  return { ok: true };
}

export async function deleteModifier(
  id: string,
  productId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("modifiers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateProduct(productId);
  return { ok: true };
}
