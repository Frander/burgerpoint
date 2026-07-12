"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  generateOrderCode,
  insertOrder,
  type OrderLineInput,
  type OrderModifierInput,
} from "@/lib/order-insert";
import type { OrderType } from "@/lib/types";

export type NewOrderModifier = OrderModifierInput;
export type NewOrderItem = OrderLineInput;

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

/**
 * Registra un pedido del storefront. Recalcula los precios desde la base (no
 * confía en el cliente). Si Supabase no está configurado, devuelve un código
 * de preview sin persistir, para poder probar el flujo de WhatsApp.
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

  if (!isSupabaseConfigured()) {
    return { ok: true, code: generateOrderCode(), preview: true };
  }

  const supabase = await createClient();
  const res = await insertOrder(supabase, {
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    type: input.type,
    address: input.address,
    notes: input.notes,
    items: input.items,
    origin: "web",
  });

  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, code: res.code, total: res.total };
}
