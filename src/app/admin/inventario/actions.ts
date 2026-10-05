"use server";

import { revalidatePath } from "next/cache";
import { sectionClient } from "@/lib/supabase/auth";
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
  const supabase = await sectionClient("inventario");
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
  const supabase = await sectionClient("inventario");
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

// ---------- Carnes (porciones, migración 0018) ----------

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Entrada de carne ("llegaron 100 porciones el día tal") o salida a mano
 * (merma, ajuste del conteo). Las ventas no pasan por aquí: las descuenta el
 * trigger sale_consume_meat al crearse el pedido.
 */
export async function addMeatMove(input: {
  meatId: string;
  type: InventoryMoveType;
  quantity: number;
  /** "2026-10-04". Vacío = hoy. */
  date?: string;
}): Promise<ActionResult> {
  const { meatId, type, quantity, date } = input;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, error: "La cantidad debe ser un número entero mayor a 0." };
  }
  if (quantity > 100000) return { ok: false, error: "Esa cantidad parece un error." };
  if (date && !FECHA_RE.test(date)) return { ok: false, error: "La fecha no es válida." };

  const supabase = await sectionClient("inventario");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("meat_moves").insert({
    meat_id: meatId,
    type,
    quantity,
    reason: type === "entrada" ? "compra" : "merma",
    ...(date ? { moved_on: date } : {}),
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/inventario");
  return { ok: true };
}

/**
 * Qué carne lleva un producto y cuántas porciones. `meatId` vacío = no lleva
 * carne (deja de descontar). Solo afecta las ventas de aquí en adelante.
 */
export async function setProductMeat(
  productIds: string[],
  meatId: string | null,
  portions: number,
): Promise<ActionResult> {
  if (productIds.length === 0) return { ok: true };
  const supabase = await sectionClient("inventario");

  if (!meatId) {
    const { error } = await supabase.from("product_meats").delete().in("product_id", productIds);
    if (error) return { ok: false, error: error.message };
  } else {
    if (!Number.isInteger(portions) || portions < 1 || portions > 10) {
      return { ok: false, error: "Las porciones deben ser entre 1 y 10." };
    }
    const { error } = await supabase.from("product_meats").upsert(
      productIds.map((product_id) => ({ product_id, meat_id: meatId, portions })),
      { onConflict: "product_id" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/inventario");
  return { ok: true };
}
