"use server";

import { revalidatePath } from "next/cache";
import { assertSection, sectionClient } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SETTING_KEYS } from "@/lib/settings";
import {
  finPausaDomicilio,
  horaValida,
  normalizarHorario,
  siguienteApertura,
  type Horario,
} from "@/lib/hours";

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

/** Horario de atención: fuera de él el bot avisa y la web no acepta pedidos. */
export async function setHorario(horario: Horario): Promise<ActionResult> {
  const supabase = await sectionClient("ajustes");

  if (!Array.isArray(horario?.dias) || horario.dias.length !== 7) {
    return { ok: false, error: "El horario no es válido." };
  }
  for (const d of horario.dias) {
    if (d.abierto && (!horaValida(d.desde) || !horaValida(d.hasta))) {
      return { ok: false, error: "Revisa las horas: deben ir como 13:00." };
    }
    if (d.abierto && d.desde === d.hasta) {
      return { ok: false, error: "La hora de apertura y la de cierre no pueden ser iguales." };
    }
  }
  if (horario.activo && horario.dias.every((d) => !d.abierto)) {
    return { ok: false, error: "Marca al menos un día abierto (o apaga el horario)." };
  }

  const value: Horario = {
    activo: horario.activo === true,
    dias: horario.dias.map((d) => ({
      abierto: d.abierto === true,
      desde: d.desde,
      hasta: d.hasta,
    })),
  };

  const { error } = await supabase.from("app_settings").upsert(
    { key: SETTING_KEYS.businessHours, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/ajustes");
  revalidatePath("/menu");
  return { ok: true };
}

/**
 * "Cerrar por hoy": deja de tomar pedidos (web y bot) hasta el siguiente turno
 * del horario. `abierto = true` lo quita y se vuelve a atender según horario.
 */
export async function setCierreManual(cerrar: boolean): Promise<ActionResult> {
  const supabase = await sectionClient("ajustes");

  // Abrir de nuevo guarda "" y no null: la columna `value` no admite nulos.
  let value = "";
  if (cerrar) {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTING_KEYS.businessHours)
      .maybeSingle();
    const horario = normalizarHorario((data as { value: unknown } | null)?.value);
    value = siguienteApertura(horario).toISOString();
  }

  const { error } = await supabase.from("app_settings").upsert(
    { key: SETTING_KEYS.closedUntil, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/ajustes");
  revalidatePath("/menu");
  return { ok: true };
}

/**
 * "Pausar domicilios" (lluvia fuerte, sin repartidor): la web y el bot dejan
 * de aceptar pedidos a domicilio por lo que queda del turno; para llevar sigue
 * normal. `pausar = false` lo reactiva.
 *
 * También lo puede usar la caja desde el PDV: es quien ve llover. Como la
 * tabla de ajustes solo deja escribir al admin (RLS de 0013), aquí se valida
 * el permiso y se escribe con la llave de servicio.
 */
export async function setPausaDomicilio(pausar: boolean): Promise<ActionResult> {
  await assertSection("ajustes", "pdv");
  const supabase = createAdminClient() ?? (await createClient());

  // Reactivar guarda "" y no null: la columna `value` no admite nulos.
  let value = "";
  if (pausar) {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTING_KEYS.businessHours)
      .maybeSingle();
    const horario = normalizarHorario((data as { value: unknown } | null)?.value);
    value = finPausaDomicilio(horario).toISOString();
  }

  const { error } = await supabase.from("app_settings").upsert(
    { key: SETTING_KEYS.deliveryPausedUntil, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/ajustes");
  revalidatePath("/admin/pdv");
  revalidatePath("/menu");
  return { ok: true };
}
