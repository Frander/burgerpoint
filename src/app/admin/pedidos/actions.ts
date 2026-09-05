"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sectionClient } from "@/lib/supabase/auth";
import { notifyOrderStatus } from "@/lib/whatsapp/notify";
import type { OrderStatus } from "@/lib/types";

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<{ ok: boolean; error?: string }> {
  // Mover el estado es trabajo de las tres pantallas: historial, KDS y PDV.
  const supabase = await sectionClient("pedidos", "cocina", "pdv");
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Aviso al cliente por WhatsApp. Con `after` para que el staff no espere a la
  // Graph API al mover una tarjeta en cocina.
  after(async () => {
    await notifyOrderStatus(id, status);
  });

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/cocina");
  return { ok: true };
}
