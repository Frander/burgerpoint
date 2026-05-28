"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function revalidateMenu() {
  revalidatePath("/admin/menu");
  revalidatePath("/"); // storefront público
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
  const supabase = await createClient();
  const { error } = await supabase.from("categories").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };
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
