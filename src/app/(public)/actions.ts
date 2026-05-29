"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { OrderType, Product } from "@/lib/types";

export interface NewOrderModifier {
  modifier_id?: string;
  name: string;
  extra_price: number;
  group_name?: string;
}

export interface NewOrderItem {
  productId: string;
  quantity: number;
  notes?: string;
  modifiers?: NewOrderModifier[];
}

export interface NewOrderInput {
  customer_name: string;
  customer_phone?: string;
  type: OrderType;
  address?: string;
  notes?: string;
  items: NewOrderItem[];
}

export interface CreateOrderResult {
  ok: boolean;
  code?: string;
  total?: number;
  preview?: boolean;
  error?: string;
}

function generateOrderCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${yy}${mm}${dd}-${rand}`;
}

/**
 * Registra un pedido. Recalcula los precios desde la base (no confía en el
 * cliente). Si Supabase no está configurado, devuelve un código de preview
 * sin persistir, para poder probar el flujo de WhatsApp.
 */
export async function createOrder(
  input: NewOrderInput,
): Promise<CreateOrderResult> {
  // Validación básica
  if (!input.customer_name?.trim()) {
    return { ok: false, error: "Falta el nombre del cliente." };
  }
  if (!input.items?.length) {
    return { ok: false, error: "El pedido está vacío." };
  }
  if (input.type === "delivery" && !input.address?.trim()) {
    return { ok: false, error: "Falta la dirección de entrega." };
  }

  const code = generateOrderCode();

  if (!isSupabaseConfigured()) {
    return { ok: true, code, preview: true };
  }

  const supabase = await createClient();

  // Traer precios reales desde la base.
  const productIds = input.items.map((i) => i.productId);
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, price, available")
    .in("id", productIds);

  if (prodErr || !products) {
    return { ok: false, error: "No se pudo validar el menú." };
  }

  const productMap = new Map<string, Pick<Product, "id" | "name" | "price">>();
  for (const p of products as Product[]) {
    if (p.available) productMap.set(p.id, p);
  }

  // Precios autoritativos de los modificadores elegidos (no se confía en el
  // cliente). Se traen por id y se valida que pertenezcan al producto correcto.
  const modifierIds = Array.from(
    new Set(
      input.items.flatMap((i) =>
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
      return { ok: false, error: "No se pudieron validar las opciones." };
    }
    for (const m of (mods ?? []) as DbModifier[]) {
      modifierMap.set(m.id, m);
    }
  }

  // Construye cada línea con su precio recalculado y sus opciones.
  const lineItems = input.items
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) return null;

      const chosen = (item.modifiers ?? [])
        .map((m) => {
          if (!m.modifier_id) return null;
          const db = modifierMap.get(m.modifier_id);
          // Debe existir y pertenecer a este producto.
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
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (lineItems.length === 0) {
    return { ok: false, error: "Los productos ya no están disponibles." };
  }

  const total = lineItems.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0,
  );

  const orderId = randomUUID();
  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    code,
    customer_name: input.customer_name.trim(),
    customer_phone: input.customer_phone?.trim() || null,
    type: input.type,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    total,
  });

  if (orderErr) {
    return { ok: false, error: "No se pudo crear el pedido." };
  }

  // Inserta cada línea y, si tiene opciones, sus order_item_modifiers.
  for (const line of lineItems) {
    const { modifiers, ...itemRow } = line;
    const { data: inserted, error: itemErr } = await supabase
      .from("order_items")
      .insert({ ...itemRow, order_id: orderId })
      .select("id")
      .single();

    if (itemErr || !inserted) {
      return { ok: false, error: "No se pudieron guardar los productos." };
    }

    if (modifiers.length > 0) {
      const { error: modErr } = await supabase
        .from("order_item_modifiers")
        .insert(
          modifiers.map((m) => ({
            order_item_id: inserted.id,
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

  return { ok: true, code, total };
}
