// Creación de pedidos compartida entre el checkout público y el PDV.
// Recalcula SIEMPRE los precios desde la base (no se confía en el cliente).

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OrderOrigin,
  OrderStatus,
  OrderType,
  Product,
} from "@/lib/types";
import { isSoldOut } from "@/lib/product";
import { getDeliveryFee } from "@/lib/settings";
import { checkCoupon, ensureCustomer, markCouponUsed } from "@/lib/loyalty";
import { notifyNewOrder, notifyOrderConfirmation } from "@/lib/whatsapp/notify";

export interface OrderModifierInput {
  modifier_id?: string;
  name: string;
  extra_price: number;
  group_name?: string;
}

export interface OrderLineInput {
  productId: string;
  quantity: number;
  notes?: string;
  modifiers?: OrderModifierInput[];
}

export interface InsertOrderInput {
  customer_name: string;
  customer_phone?: string | null;
  type: OrderType;
  address?: string | null;
  notes?: string | null;
  items: OrderLineInput[];
  origin?: OrderOrigin;
  status?: OrderStatus;
  /**
   * Envío a cobrar. Si no se pasa, los domicilios toman la tarifa de Ajustes;
   * el PDV sí lo manda siempre (la cajera puede cambiarlo pedido por pedido).
   */
  delivery_fee?: number;
  /** Cupón de puntos a aplicar. Si no sirve, el pedido NO se crea. */
  coupon_code?: string | null;
  mesa_id?: string | null;
  served_by?: string | null;
}

export interface InsertOrderResult {
  ok: boolean;
  orderId?: string;
  code?: string;
  total?: number;
  error?: string;
}

interface PricedLine {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  modifiers: { modifier_name: string; extra_price: number; group_name: string | null }[];
}

export function generateOrderCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${yy}${mm}${dd}-${rand}`;
}

/**
 * Recalcula las líneas de un pedido con los precios reales del menú.
 * Descarta productos no disponibles y opciones que no pertenecen al producto.
 */
export async function priceLines(
  supabase: SupabaseClient,
  items: OrderLineInput[],
): Promise<{ lines: PricedLine[]; error?: string }> {
  const productIds = items.map((i) => i.productId);
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, price, available, track_stock, stock")
    .in("id", productIds);

  if (prodErr || !products) {
    return { lines: [], error: "No se pudo validar el menú." };
  }

  // Los agotados se muestran en el menú, así que aquí es donde se rechazan.
  const productMap = new Map<string, Pick<Product, "id" | "name" | "price">>();
  for (const p of products as Product[]) {
    if (!isSoldOut(p)) productMap.set(p.id, p);
  }

  const modifierIds = Array.from(
    new Set(
      items.flatMap((i) =>
        (i.modifiers ?? [])
          .map((m) => m.modifier_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  );

  interface DbModifier {
    id: string;
    product_id: string;
    name: string;
    extra_price: number;
  }
  const modifierMap = new Map<string, DbModifier>();
  if (modifierIds.length > 0) {
    const { data: mods, error: modErr } = await supabase
      .from("modifiers")
      .select("id, product_id, name, extra_price")
      .in("id", modifierIds);
    if (modErr) {
      return { lines: [], error: "No se pudieron validar las opciones." };
    }
    for (const m of (mods ?? []) as DbModifier[]) modifierMap.set(m.id, m);
  }

  const lines = items
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) return null;

      const chosen = (item.modifiers ?? [])
        .map((m) => {
          if (!m.modifier_id) return null;
          const db = modifierMap.get(m.modifier_id);
          if (!db || db.product_id !== product.id) return null;
          return {
            modifier_name: db.name,
            extra_price: db.extra_price,
            group_name: m.group_name ?? null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const extras = chosen.reduce((sum, m) => sum + m.extra_price, 0);

      return {
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price + extras,
        notes: item.notes?.trim() || null,
        modifiers: chosen,
      };
    })
    .filter((x): x is PricedLine => x !== null);

  return { lines };
}

/** Líneas en el formato que esperan las funciones de la base (0017). */
function linesPayload(lines: PricedLine[]) {
  return lines.map(({ modifiers, ...item }) => ({ ...item, modifiers }));
}

/**
 * Agrega líneas (y sus opciones) a un pedido ya creado, todas en una sola
 * transacción (`insert_order_items`, migración 0017): o entran todas o ninguna.
 */
export async function insertLines(
  supabase: SupabaseClient,
  orderId: string,
  lines: PricedLine[],
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("insert_order_items", {
    p_order_id: orderId,
    p_items: linesPayload(lines),
  });
  if (error) {
    console.error("[pedidos] no se pudieron guardar las líneas:", error.message);
    return { ok: false, error: "No se pudieron guardar los productos." };
  }
  return { ok: true };
}

/** Crea un pedido completo (encabezado + líneas) con precios recalculados. */
export async function insertOrder(
  supabase: SupabaseClient,
  input: InsertOrderInput,
): Promise<InsertOrderResult> {
  const { lines, error: priceErr } = await priceLines(supabase, input.items);
  if (priceErr) return { ok: false, error: priceErr };
  if (lines.length === 0) {
    return { ok: false, error: "Los productos ya no están disponibles." };
  }

  // El envío se cobra solo en domicilio, y por defecto con la tarifa de
  // Ajustes: así la web, el bot y el PDV cobran lo mismo sin repetir el número.
  const deliveryFee =
    input.type === "delivery" ? (input.delivery_fee ?? (await getDeliveryFee())) : 0;
  const comida = lines.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  // El cupón descuenta sobre la comida, nunca sobre el envío: ese dinero es del
  // repartidor. Si el cupón no sirve se corta aquí, antes de crear nada, para
  // que el cliente no acabe pagando de más creyendo que aplicó.
  let discount = 0;
  let couponId: string | null = null;
  if (input.coupon_code?.trim()) {
    const check = await checkCoupon(input.coupon_code, comida);
    if (!check.ok) return { ok: false, error: check.error };
    discount = check.discount ?? 0;
    couponId = check.couponId ?? null;
  }

  const total = comida + deliveryFee - discount;

  const orderId = randomUUID();
  const code = generateOrderCode();
  // Pedido y productos entran juntos en una transacción (`create_order`,
  // migración 0017). Si se insertaran por separado, Realtime avisaría del
  // pedido antes de que tuviera todas sus líneas y el PDV, la cocina y el
  // agente de impresión lo leerían incompleto.
  const { error: orderErr } = await supabase.rpc("create_order", {
    p_order: {
      id: orderId,
      code,
      customer_name: input.customer_name.trim(),
      customer_phone: input.customer_phone?.trim() || null,
      type: input.type,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      total,
      origin: input.origin ?? "web",
      status: input.status ?? "nuevo",
      delivery_fee: deliveryFee,
      discount,
      coupon_id: couponId,
      mesa_id: input.mesa_id ?? null,
      served_by: input.served_by ?? null,
    },
    p_items: linesPayload(lines),
  });

  if (orderErr) {
    console.error("[pedidos] no se pudo crear el pedido:", orderErr.message);
    return { ok: false, error: "No se pudo crear el pedido." };
  }

  // El cupón se quema ya con el pedido creado. Si alguien lo usó un instante
  // antes, el pedido se queda con el descuento: es menos malo que cobrarle de
  // más a alguien que ya está en la pantalla de "listo".
  if (couponId) await markCouponUsed(couponId, orderId);

  // Quien pide queda dado de alta para el programa de puntos; los puntos se
  // acreditan después, al entregarse y pagarse.
  if (input.customer_phone) {
    await ensureCustomer(input.customer_phone, input.customer_name);
  }

  // Alerta interna por WhatsApp. Va con `after` para no hacer esperar al
  // cliente por la Graph API, y aislada para que un fallo de Meta no convierta
  // un pedido bueno en un error. Aquí pasan los pedidos web, los del PDV y los
  // que cree el bot, así que es el único punto donde hay que engancharla.
  try {
    after(async () => {
      await notifyNewOrder({
        orderId,
        code,
        type: input.type,
        customerName: input.customer_name.trim(),
        total,
      });
      // Al cliente: confirmación de su domicilio pedido desde la web. Los del
      // bot ya la reciben en el chat y los del PDV los toma la cajera.
      if ((input.origin ?? "web") === "web" && input.type === "delivery") {
        await notifyOrderConfirmation(orderId);
      }
    });
  } catch {
    // `after` solo existe dentro de una petición; fuera de ella se omite.
  }

  return { ok: true, orderId, code, total };
}
