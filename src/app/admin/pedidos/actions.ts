"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sectionClient } from "@/lib/supabase/auth";
import { notifyOrderStatus } from "@/lib/whatsapp/notify";
import { awardPointsForOrder } from "@/lib/loyalty";
import { defaultCourierPatch } from "@/lib/couriers";
import type { OrderStatus } from "@/lib/types";

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<{ ok: boolean; error?: string }> {
  // Mover el estado es trabajo de las tres pantallas: historial, KDS y PDV.
  const supabase = await sectionClient("pedidos", "cocina", "pdv");
  // La hora de cierre se sella aquí también: el reporte de envíos y la pantalla
  // del repartidor cuentan por `closed_at`, y un pedido entregado desde cocina
  // o el historial se quedaba sin ella. Si se reabre, se limpia.
  const cerrado = status === "entregado" || status === "cancelado";
  // Un domicilio que sale en camino o se entrega sin repartidor se queda con
  // el de por defecto, igual que al mandarlo desde el PDV.
  const repartidor =
    status === "listo" || status === "entregado" ? await defaultCourierPatch(id) : {};
  const { error } = await supabase
    .from("orders")
    .update({
      status,
      closed_at: cerrado ? new Date().toISOString() : null,
      ...repartidor,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Aviso al cliente por WhatsApp. Con `after` para que el staff no espere a la
  // Graph API al mover una tarjeta en cocina.
  after(async () => {
    await notifyOrderStatus(id, status);
    // Solo acredita si quedó entregado Y pagado; da igual llamarla de más.
    await awardPointsForOrder(id);
  });

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/cocina");
  revalidatePath("/repartidor");
  return { ok: true };
}
