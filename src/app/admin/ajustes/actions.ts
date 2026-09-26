"use server";

import { revalidatePath } from "next/cache";
import { sectionClient } from "@/lib/supabase/auth";
import { SETTING_KEYS } from "@/lib/settings";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Elige el repartidor por defecto. `courierId` vacío lo quita: entonces la
 * caja vuelve a tener que elegir a mano al mandar un domicilio en camino.
 */
export async function setDefaultCourier(courierId: string): Promise<ActionResult> {
  const supabase = await sectionClient("ajustes");

  if (courierId) {
    // Que siga siendo repartidor: si le cambiaron el rol, guardarlo dejaría un
    // ajuste que no se puede cumplir.
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", courierId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if ((data as { role: string } | null)?.role !== "repartidor") {
      return { ok: false, error: "Esa persona ya no es repartidor." };
    }
  }

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: SETTING_KEYS.defaultCourier,
      value: courierId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/ajustes");
  revalidatePath("/admin/pdv");
  return { ok: true };
}

/**
 * Precio fijo del envío a domicilio: es lo que se le cobra al cliente y lo que
 * gana el repartidor por esa entrega. 0 = envío gratis.
 */
export async function setDeliveryFee(fee: number): Promise<ActionResult> {
  const supabase = await sectionClient("ajustes");

  if (!Number.isFinite(fee) || fee < 0) {
    return { ok: false, error: "El precio no es válido." };
  }
  if (fee > 10000) return { ok: false, error: "Ese precio parece un error." };

  // Dos decimales: es dinero, y así no entra 33.333333 desde el formulario.
  const value = Math.round(fee * 100) / 100;

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: SETTING_KEYS.deliveryFee,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/ajustes");
  revalidatePath("/admin/pdv");
  revalidatePath("/menu");
  return { ok: true };
}

/** Reglas del programa de puntos. Los tres valores se guardan juntos. */
export async function setLoyaltyConfig(input: {
  pesosPorPunto: number;
  puntosPorCupon: number;
  porcentaje: number;
}): Promise<ActionResult> {
  const supabase = await sectionClient("ajustes");

  const { pesosPorPunto, puntosPorCupon, porcentaje } = input;
  if (!(pesosPorPunto > 0)) {
    return { ok: false, error: "Los pesos por punto deben ser mayores a 0." };
  }
  if (!Number.isInteger(puntosPorCupon) || puntosPorCupon <= 0) {
    return { ok: false, error: "Los puntos del cupón deben ser un número entero." };
  }
  if (!(porcentaje > 0) || porcentaje > 100) {
    return { ok: false, error: "El descuento debe estar entre 1 y 100." };
  }

  const ahora = new Date().toISOString();
  const { error } = await supabase.from("app_settings").upsert(
    [
      { key: SETTING_KEYS.pointsPerAmount, value: pesosPorPunto, updated_at: ahora },
      { key: SETTING_KEYS.couponPointsCost, value: puntosPorCupon, updated_at: ahora },
      { key: SETTING_KEYS.couponPercent, value: porcentaje, updated_at: ahora },
    ],
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/ajustes");
  revalidatePath("/cuenta");
  return { ok: true };
}
