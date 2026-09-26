import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLoyaltyConfig } from "@/lib/settings";
import { normalizePhone, maskPhone } from "@/lib/whatsapp/phone";

/**
 * Programa de puntos (migración 0015).
 *
 * Reglas que no se negocian:
 *   · Los puntos de un cliente son la SUMA de `point_moves`, nunca un contador
 *     editable: así se puede auditar de dónde salió cada punto.
 *   · Un pedido acredita puntos una sola vez. Lo garantiza un índice único en
 *     la base, no este código: si dos procesos entran a la vez, uno choca.
 *   · Todo pasa por la llave de servicio. Quien llama ya validó quién es.
 */

/** Letras y números sin los que se confunden al dictarlos por teléfono. */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function nuevoCodigo(largo = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(largo));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

export interface CustomerSummary {
  phone: string;
  name: string;
  verified: boolean;
  points: number;
  /** Puntos que le faltan para el siguiente cupón (0 si ya puede canjear). */
  faltan: number;
  config: { puntosPorCupon: number; porcentaje: number; pesosPorPunto: number };
}

export interface CouponRow {
  id: string;
  code: string;
  percent: number;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
}

/** Alta o actualización del cliente. Devuelve el teléfono normalizado. */
export async function ensureCustomer(
  rawPhone: string,
  name?: string | null,
): Promise<string | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;

  const db = createAdminClient();
  if (!db) return null;

  const { data } = await db
    .from("customers")
    .select("phone, name")
    .eq("phone", phone)
    .maybeSingle();

  const nombre = name?.trim();
  if (!data) {
    await db.from("customers").insert({ phone, name: nombre || "Cliente" });
  } else if (nombre && nombre !== (data as { name: string }).name) {
    // El nombre más reciente gana: el cliente se corrige solo al pedir.
    await db.from("customers").update({ name: nombre }).eq("phone", phone);
  }
  return phone;
}

export async function getPoints(phone: string): Promise<number> {
  const db = createAdminClient();
  if (!db) return 0;

  const { data } = await db.from("point_moves").select("points").eq("phone", phone);
  return ((data ?? []) as { points: number }[]).reduce((s, m) => s + m.points, 0);
}

/** Todo lo que hace falta para pintar la pantalla del cliente. */
export async function getCustomerSummary(
  phone: string,
): Promise<CustomerSummary | null> {
  const db = createAdminClient();
  if (!db) return null;

  const [{ data }, points, config] = await Promise.all([
    db.from("customers").select("phone, name, verified_at").eq("phone", phone).maybeSingle(),
    getPoints(phone),
    getLoyaltyConfig(),
  ]);
  const row = data as { phone: string; name: string; verified_at: string | null } | null;
  if (!row) return null;

  return {
    phone: row.phone,
    name: row.name,
    verified: Boolean(row.verified_at),
    points,
    faltan: Math.max(config.puntosPorCupon - points, 0),
    config: {
      puntosPorCupon: config.puntosPorCupon,
      porcentaje: config.porcentaje,
      pesosPorPunto: config.pesosPorPunto,
    },
  };
}

export async function getCoupons(phone: string): Promise<CouponRow[]> {
  const db = createAdminClient();
  if (!db) return [];

  const { data } = await db
    .from("coupons")
    .select("id, code, percent, created_at, expires_at, used_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as CouponRow[];
}

/**
 * Acredita los puntos de un pedido, si toca. Es seguro llamarla de más: solo
 * hace algo cuando el pedido está ENTREGADO y PAGADO, y el índice único de
 * `point_moves` impide pagar dos veces el mismo pedido.
 *
 * Los puntos salen de la comida: al total se le quita el envío (ese dinero es
 * del repartidor). El descuento del cupón ya viene restado del total.
 */
export async function awardPointsForOrder(orderId: string): Promise<number> {
  const db = createAdminClient();
  if (!db) return 0;

  const { data } = await db
    .from("orders")
    .select("id, status, payment_status, total, delivery_fee, customer_phone, customer_name")
    .eq("id", orderId)
    .maybeSingle();

  const order = data as {
    status: string;
    payment_status: string;
    total: number;
    delivery_fee: number;
    customer_phone: string | null;
    customer_name: string | null;
  } | null;

  if (!order) return 0;
  if (order.status !== "entregado" || order.payment_status !== "pagado") return 0;

  const phone = await ensureCustomer(order.customer_phone ?? "", order.customer_name);
  if (!phone) return 0;

  const { pesosPorPunto } = await getLoyaltyConfig();
  const comida = Number(order.total) - Number(order.delivery_fee);
  const puntos = Math.floor(Math.max(comida, 0) / pesosPorPunto);
  if (puntos <= 0) return 0;

  const { error } = await db.from("point_moves").insert({
    phone,
    points: puntos,
    reason: "pedido",
    order_id: orderId,
  });

  // 23505 = ya se habían acreditado. Es el caso normal al reintentar.
  if (error) {
    if (error.code !== "23505") {
      console.warn(`[puntos] ${maskPhone(phone)}: ${error.message}`);
    }
    return 0;
  }

  // El teléfono con el que se acreditó, para poder rastrearlo después.
  await db.from("orders").update({ customer_phone_key: phone }).eq("id", orderId);
  return puntos;
}

export interface RedeemResult {
  ok: boolean;
  code?: string;
  percent?: number;
  error?: string;
}

/**
 * Cambia puntos por un cupón de descuento. Descontar los puntos y crear el
 * cupón van juntos: si falla lo segundo, se devuelven los puntos.
 */
export async function redeemCoupon(phone: string): Promise<RedeemResult> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "No se pudo conectar." };

  const config = await getLoyaltyConfig();
  const puntos = await getPoints(phone);
  if (puntos < config.puntosPorCupon) {
    return {
      ok: false,
      error: `Te faltan ${config.puntosPorCupon - puntos} puntos para un cupón.`,
    };
  }

  // Primero se apartan los puntos: si alguien pide dos cupones a la vez, el
  // segundo se queda sin saldo en vez de llevarse dos.
  const { data: movimiento, error: errMov } = await db
    .from("point_moves")
    .insert({
      phone,
      points: -config.puntosPorCupon,
      reason: "cupon",
      note: `Cupón de ${config.porcentaje}%`,
    })
    .select("id")
    .maybeSingle();
  if (errMov) return { ok: false, error: "No se pudo canjear. Intenta de nuevo." };

  const saldo = await getPoints(phone);
  if (saldo < 0) {
    await db.from("point_moves").delete().eq("id", (movimiento as { id: string }).id);
    return { ok: false, error: "Te quedaste sin puntos suficientes." };
  }

  // Vence en 60 días: un cupón eterno es un descuento eterno.
  const expira = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  for (let intento = 0; intento < 5; intento++) {
    const code = nuevoCodigo();
    const { data, error } = await db
      .from("coupons")
      .insert({
        code,
        phone,
        percent: config.porcentaje,
        points_cost: config.puntosPorCupon,
        expires_at: expira,
      })
      .select("id, code, percent")
      .maybeSingle();

    if (!error && data) {
      const cupon = data as { id: string; code: string; percent: number };
      await db
        .from("point_moves")
        .update({ coupon_id: cupon.id })
        .eq("id", (movimiento as { id: string }).id);
      return { ok: true, code: cupon.code, percent: Number(cupon.percent) };
    }
    // 23505 = el código ya existía; se prueba otro.
    if (error && error.code !== "23505") break;
  }

  // No se pudo crear el cupón: los puntos vuelven.
  await db.from("point_moves").delete().eq("id", (movimiento as { id: string }).id);
  return { ok: false, error: "No se pudo generar el cupón. Intenta de nuevo." };
}

export interface CouponCheck {
  ok: boolean;
  couponId?: string;
  percent?: number;
  /** Descuento en pesos que corresponde a `amount`. */
  discount?: number;
  error?: string;
}

/**
 * Revisa un cupón contra un monto (la comida, sin envío) y dice cuánto
 * descuenta. No lo marca como usado: eso pasa al crear el pedido.
 */
export async function checkCoupon(
  rawCode: string,
  amount: number,
): Promise<CouponCheck> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "No se pudo conectar." };

  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Escribe el código del cupón." };

  const { data } = await db
    .from("coupons")
    .select("id, percent, used_at, expires_at")
    .eq("code", code)
    .maybeSingle();

  const cupon = data as {
    id: string;
    percent: number;
    used_at: string | null;
    expires_at: string | null;
  } | null;

  if (!cupon) return { ok: false, error: "Ese cupón no existe." };
  if (cupon.used_at) return { ok: false, error: "Ese cupón ya se usó." };
  if (cupon.expires_at && new Date(cupon.expires_at) < new Date()) {
    return { ok: false, error: "Ese cupón ya venció." };
  }

  const percent = Number(cupon.percent);
  const discount = Math.round(Math.max(amount, 0) * percent) / 100;
  return { ok: true, couponId: cupon.id, percent, discount };
}

/**
 * Marca el cupón como usado en un pedido. Si alguien lo usó primero, devuelve
 * false y quien llama decide (el pedido ya se creó: no se tumba por esto).
 */
export async function markCouponUsed(
  couponId: string,
  orderId: string,
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;

  const { data } = await db
    .from("coupons")
    .update({ used_at: new Date().toISOString(), order_id: orderId })
    .eq("id", couponId)
    .is("used_at", null)
    .select("id");

  return ((data ?? []) as unknown[]).length > 0;
}
