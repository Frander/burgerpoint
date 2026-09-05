"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSection } from "@/lib/supabase/auth";
import { notifyOrderStatus } from "@/lib/whatsapp/notify";

interface Result {
  ok: boolean;
  error?: string;
}

/**
 * El repartidor marca su pedido como entregado.
 *
 * Doble candado a propósito: las políticas RLS de 0011 ya impiden que toque un
 * pedido que no trae él, y además aquí se verifica el `courier_id` y que el
 * pedido siga en camino, para que un doble toque en el celular no reabra ni
 * "re-entregue" nada.
 */
export async function markDelivered(orderId: string): Promise<Result> {
  const profile = await assertSection("entregas");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("id, code, status, courier_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Ese pedido ya no está disponible." };

  const order = data as { status: string; courier_id: string | null };
  if (profile.role === "repartidor" && order.courier_id !== profile.id) {
    return { ok: false, error: "Ese pedido no está asignado a ti." };
  }
  if (order.status === "entregado") return { ok: true }; // ya estaba, no es error
  if (order.status !== "listo") {
    return { ok: false, error: "El pedido todavía no va en camino." };
  }

  const { error: upErr } = await supabase
    .from("orders")
    .update({ status: "entregado", closed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "listo");
  if (upErr) return { ok: false, error: upErr.message };

  after(async () => {
    await notifyOrderStatus(orderId, "entregado");
  });

  revalidatePath("/repartidor");
  revalidatePath("/admin/pdv");
  revalidatePath("/admin/pedidos");
  return { ok: true };
}
