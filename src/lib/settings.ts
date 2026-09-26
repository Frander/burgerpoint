import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ajustes del negocio (tabla `app_settings`, migración 0013).
 *
 * Si la migración todavía no se corrió, leer devuelve el valor por defecto en
 * vez de reventar: el PDV y la caja tienen que seguir vendiendo.
 */

export const SETTING_KEYS = {
  /** Repartidor que se asigna solo al mandar un domicilio en camino. */
  defaultCourier: "default_courier_id",
  /** Precio fijo del envío a domicilio (y lo que gana el repartidor). */
  deliveryFee: "delivery_fee",
  /** Pesos de comida que hacen falta para ganar 1 punto. */
  pointsPerAmount: "points_per_amount",
  /** Puntos que cuesta un cupón. */
  couponPointsCost: "coupon_points_cost",
  /** Descuento del cupón, en por ciento. */
  couponPercent: "coupon_percent",
} as const;

/** Valores con los que arranca el programa de puntos si nadie los ha tocado. */
export const LOYALTY_DEFAULTS = {
  pesosPorPunto: 10,
  puntosPorCupon: 100,
  porcentaje: 10,
} as const;

export interface LoyaltyConfig {
  /** Pesos de comida por punto (10 = 1 punto por cada $10). */
  pesosPorPunto: number;
  /** Puntos que hay que juntar para un cupón. */
  puntosPorCupon: number;
  /** Descuento del cupón, en por ciento. */
  porcentaje: number;
}

export async function getSetting(key: string): Promise<unknown> {
  // Los ajustes solo los lee el staff (RLS de 0013), pero quien crea un pedido
  // a domicilio puede ser un cliente de la web o el bot, sin sesión. Por eso se
  // prefiere la llave de servicio y el cliente con sesión queda de respaldo.
  const supabase = createAdminClient() ?? (await createClient());
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.warn(`[ajustes] no se pudo leer "${key}":`, error.message);
    return null;
  }
  return (data as { value: unknown } | null)?.value ?? null;
}

/** Id del repartidor por defecto, o null si no hay ninguno elegido. */
export async function getDefaultCourierId(): Promise<string | null> {
  const value = await getSetting(SETTING_KEYS.defaultCourier);
  return typeof value === "string" && value ? value : null;
}

/**
 * Precio del envío que se cobra en los domicilios y que gana el repartidor.
 * Sin ajuste guardado son 0: el envío sale gratis, no se rompe nada.
 */
export async function getDeliveryFee(): Promise<number> {
  const value = await getSetting(SETTING_KEYS.deliveryFee);
  const fee = Number(value);
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
}

function positivo(value: unknown, porDefecto: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

/** Reglas del programa de puntos (Ajustes → Programa de puntos). */
export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  const [pesos, puntos, porcentaje] = await Promise.all([
    getSetting(SETTING_KEYS.pointsPerAmount),
    getSetting(SETTING_KEYS.couponPointsCost),
    getSetting(SETTING_KEYS.couponPercent),
  ]);

  return {
    pesosPorPunto: positivo(pesos, LOYALTY_DEFAULTS.pesosPorPunto),
    puntosPorCupon: positivo(puntos, LOYALTY_DEFAULTS.puntosPorCupon),
    porcentaje: Math.min(positivo(porcentaje, LOYALTY_DEFAULTS.porcentaje), 100),
  };
}
