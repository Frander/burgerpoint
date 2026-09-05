"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSection } from "@/lib/supabase/auth";
import { notifyOrderStatus } from "@/lib/whatsapp/notify";
import { getProduct } from "@/lib/menu";
import {
  insertLines,
  insertOrder,
  priceLines,
  type OrderLineInput,
} from "@/lib/order-insert";
import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  ProductWithModifiers,
} from "@/lib/types";

const PDV_PATHS = ["/admin/pdv", "/admin/pedidos", "/admin/cocina"];

function revalidatePdv() {
  for (const path of PDV_PATHS) revalidatePath(path);
}

export interface PdvOrderInput {
  type: OrderType;
  items: OrderLineInput[];
  customer_name?: string;
  customer_phone?: string;
  address?: string;
  notes?: string;
  delivery_fee?: number;
  mesa_id?: string;
}

export interface PdvActionResult {
  ok: boolean;
  orderId?: string;
  code?: string;
  total?: number;
  error?: string;
}

/** Nombre por defecto cuando el cajero no captura cliente. */
function defaultCustomerName(type: OrderType): string {
  switch (type) {
    case "en_mesa":
      return "Mesa";
    case "delivery":
      return "Cliente";
    default:
      return "Mostrador";
  }
}

/**
 * Crea un pedido desde el PDV. Entra directo a cocina (estado en_cocina),
 * con origen pdv y el nombre del staff que lo tomó.
 */
export async function createPdvOrder(
  input: PdvOrderInput,
): Promise<PdvActionResult> {
  const profile = await assertSection("pdv");

  if (!input.items?.length) {
    return { ok: false, error: "El pedido está vacío." };
  }
  if (input.type === "delivery" && !input.address?.trim()) {
    return { ok: false, error: "Falta la dirección de entrega." };
  }
  if (input.type === "en_mesa" && !input.mesa_id) {
    return { ok: false, error: "Elige una mesa." };
  }

  const supabase = await createClient();
  const res = await insertOrder(supabase, {
    customer_name: input.customer_name?.trim() || defaultCustomerName(input.type),
    customer_phone: input.customer_phone,
    type: input.type,
    address: input.address,
    notes: input.notes,
    items: input.items,
    origin: "pdv",
    status: "en_cocina",
    delivery_fee: input.type === "delivery" ? (input.delivery_fee ?? 0) : 0,
    mesa_id: input.type === "en_mesa" ? input.mesa_id : null,
    served_by: profile.full_name || profile.email,
  });

  if (res.ok) revalidatePdv();
  return res;
}

/** Agrega líneas a un pedido abierto (p. ej. una mesa) y recalcula el total. */
export async function addItemsToOrder(
  orderId: string,
  items: OrderLineInput[],
): Promise<PdvActionResult> {
  await assertSection("pdv");
  if (!items?.length) return { ok: false, error: "No hay productos que agregar." };

  const supabase = await createClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status, total, delivery_fee")
    .eq("id", orderId)
    .single();
  if (orderErr || !order) return { ok: false, error: "No existe el pedido." };
  if (order.status === "entregado" || order.status === "cancelado") {
    return { ok: false, error: "El pedido ya está cerrado." };
  }

  const { lines, error: priceErr } = await priceLines(supabase, items);
  if (priceErr) return { ok: false, error: priceErr };
  if (lines.length === 0) {
    return { ok: false, error: "Los productos ya no están disponibles." };
  }

  const linesRes = await insertLines(supabase, orderId, lines);
  if (!linesRes.ok) return { ok: false, error: linesRes.error };

  const added = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const { error: updErr } = await supabase
    .from("orders")
    .update({ total: Number(order.total) + added, payment_status: "no_pagado" })
    .eq("id", orderId);
  if (updErr) return { ok: false, error: "No se pudo actualizar el total." };

  revalidatePdv();
  return { ok: true, orderId };
}

/** Registra un pago; el trigger de la base marca pagado al cubrir el total. */
export async function registerPayment(
  orderId: string,
  method: PaymentMethod,
  amount: number,
  received?: number,
): Promise<PdvActionResult> {
  const profile = await assertSection("pdv");
  if (!(amount > 0)) return { ok: false, error: "El monto debe ser mayor a 0." };

  const supabase = await createClient();

  // Liga el pago a la caja abierta (si el módulo de cajas ya está migrado).
  let cashSessionId: string | null = null;
  const { data: session, error: sessionErr } = await supabase
    .from("cash_sessions")
    .select("id")
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sessionErr && session) cashSessionId = session.id;

  const row: Record<string, unknown> = {
    order_id: orderId,
    method,
    amount,
    received: method === "efectivo" ? (received ?? amount) : null,
    created_by: profile.id,
  };
  if (cashSessionId) row.cash_session_id = cashSessionId;

  const { error } = await supabase.from("order_payments").insert(row);
  if (error) return { ok: false, error: error.message };

  revalidatePdv();
  return { ok: true, orderId };
}

/** Finaliza (entrega) un pedido y sella la hora de cierre. */
export async function finalizeOrder(orderId: string): Promise<PdvActionResult> {
  await assertSection("pdv");
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "entregado", closed_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  after(async () => {
    await notifyOrderStatus(orderId, "entregado");
  });
  revalidatePdv();
  return { ok: true, orderId };
}

/** Cancela un pedido abierto. */
export async function cancelOrder(orderId: string): Promise<PdvActionResult> {
  await assertSection("pdv");
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelado", closed_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  after(async () => {
    await notifyOrderStatus(orderId, "cancelado");
  });
  revalidatePdv();
  return { ok: true, orderId };
}

/** Producto con sus grupos de opciones, para el selector del PDV. */
export async function getProductOptions(
  productId: string,
): Promise<ProductWithModifiers | null> {
  await assertSection("pdv");
  return getProduct(productId);
}

/**
 * Manda un pedido a domicilio en camino y le asigna repartidor en un solo paso.
 *
 * Va junto a propósito: un pedido "en camino" sin repartidor no le aparece a
 * nadie en el celular, así que separarlo en dos botones invita a olvidarlo.
 * `courierId` null solo se acepta para reasignar un pedido que ya iba en
 * camino (por si el repartidor cambia a media entrega).
 */
export async function assignCourier(
  orderId: string,
  courierId: string | null,
  options: { enviar?: boolean } = {},
): Promise<PdvActionResult> {
  await assertSection("pdv");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("id, type, status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "El pedido ya no existe." };

  const order = data as { type: OrderType; status: OrderStatus };
  if (order.type !== "delivery") {
    return { ok: false, error: "Solo los pedidos a domicilio llevan repartidor." };
  }
  if (order.status === "entregado" || order.status === "cancelado") {
    return { ok: false, error: "Ese pedido ya está cerrado." };
  }
  if (options.enviar && !courierId) {
    return { ok: false, error: "Elige quién lo lleva." };
  }

  const patch: Record<string, unknown> = {
    courier_id: courierId,
    assigned_at: courierId ? new Date().toISOString() : null,
  };
  if (options.enviar) patch.status = "listo";

  const { error: upErr } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId);
  if (upErr) return { ok: false, error: upErr.message };

  // El aviso al cliente ("va en camino") solo cuando de verdad cambió el estado.
  if (options.enviar && order.status !== "listo") {
    after(async () => {
      await notifyOrderStatus(orderId, "listo");
    });
  }

  revalidatePdv();
  revalidatePath("/repartidor");
  return { ok: true };
}
