// Creación de pedidos compartida entre el checkout público y el PDV.
// Recalcula SIEMPRE los precios desde la base (no se confía en el cliente).

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OrderOrigin,
  OrderStatus,
  OrderType,
  Product,
} from "@/lib/types";

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
  delivery_fee?: number;
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
    .select("id, name, price, available")
    .in("id", productIds);

  if (prodErr || !products) {
    return { lines: [], error: "No se pudo validar el menú." };
  }

  const productMap = new Map<string, Pick<Product, "id" | "name" | "price">>();
  for (const p of products as Product[]) {
    if (p.available) productMap.set(p.id, p);
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

/**
 * Inserta las líneas (y sus opciones) de un pedido ya creado.
 * Los ids se generan aquí (sin RETURNING): el rol anónimo puede INSERTar
 * pedidos pero no leerlos, y `insert().select()` requeriría SELECT.
 */
export async function insertLines(
  supabase: SupabaseClient,
  orderId: string,
  lines: PricedLine[],
): Promise<{ ok: boolean; error?: string }> {
  for (const line of lines) {
    const { modifiers, ...itemRow } = line;
    const itemId = randomUUID();
    const { error: itemErr } = await supabase
      .from("order_items")
      .insert({ ...itemRow, id: itemId, order_id: orderId });

    if (itemErr) {
      return { ok: false, error: "No se pudieron guardar los productos." };
    }

    if (modifiers.length > 0) {
      const { error: modErr } = await supabase.from("order_item_modifiers").insert(
        modifiers.map((m) => ({
          order_item_id: itemId,
          modifier_name: m.modifier_name,
          extra_price: m.extra_price,
          group_name: m.group_name,
        })),
      );
      if (modErr) {
        return { ok: false, error: "No se pudieron guardar las opciones." };
      }
    }
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

  const deliveryFee = input.delivery_fee ?? 0;
  const total =
    lines.reduce((sum, i) => sum + i.unit_price * i.quantity, 0) + deliveryFee;

  const orderId = randomUUID();
  const code = generateOrderCode();
  const { error: orderErr } = await supabase.from("orders").insert({
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
    mesa_id: input.mesa_id ?? null,
    served_by: input.served_by ?? null,
  });

  if (orderErr) {
    return { ok: false, error: "No se pudo crear el pedido." };
  }

  const linesRes = await insertLines(supabase, orderId, lines);
  if (!linesRes.ok) return { ok: false, error: linesRes.error };

  return { ok: true, orderId, code, total };
}
