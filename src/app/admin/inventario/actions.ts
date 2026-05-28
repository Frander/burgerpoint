"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { InventoryMoveType } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Activa/desactiva el rastreo de inventario de un producto. */
export async function setTrackStock(
  productId: string,
  track: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ track_stock: track })
    .eq("id", productId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/inventario");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Registra un movimiento de inventario. El stock del producto lo ajusta
 * automáticamente el trigger apply_inventory_move (migración 0003).
 */
export async function addInventoryMove(
  productId: string,
  type: InventoryMoveType,
  quantity: number,
  reason?: string,
): Promise<ActionResult> {
  if (!(quantity > 0)) return { ok: false, error: "Cantidad inválida." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("inventory_moves").insert({
    product_id: productId,
    type,
    quantity,
    reason: reason?.trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/inventario");
  revalidatePath("/");
  return { ok: true };
}
