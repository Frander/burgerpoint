import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderType } from "@/lib/types";

/**
 * Memoria de la conversación. WhatsApp manda cada mensaje suelto, así que el
 * "en qué paso vamos" vive en `wa_sessions` (migración 0009).
 */

export type BotState =
  | "inicio"
  | "categoria" // esperando número de categoría
  | "producto" // esperando número de producto
  | "opciones" // esperando opciones del grupo `groupIndex`
  | "cantidad"
  | "carrito" // esperando qué hacer con el carrito
  | "tipo" // para llevar / a domicilio
  | "nombre"
  | "direccion"
  | "confirmar";

export interface CartModifier {
  modifier_id: string;
  name: string;
  extra_price: number;
  group_name: string;
}

export interface CartLine {
  productId: string;
  name: string;
  /** Precio unitario ya con extras. Solo para mostrar: al crear el pedido se
   * recalcula todo contra la base. */
  unitPrice: number;
  quantity: number;
  modifiers: CartModifier[];
}

/** Producto a medio armar (eligiendo opciones y cantidad). */
export interface PendingLine {
  productId: string;
  name: string;
  basePrice: number;
  groupIndex: number;
  modifiers: CartModifier[];
}

export interface SessionData {
  cart?: CartLine[];
  /** Ids que corresponden a los números mostrados en el último listado. */
  listIds?: string[];
  /** Categoría en la que está navegando (para el botón "volver"). */
  categoryId?: string;
  pending?: PendingLine;
  type?: OrderType;
  customerName?: string;
  address?: string;
}

export interface BotSession {
  phone: string;
  state: BotState;
  data: SessionData;
}

const EMPTY: SessionData = {};

export async function getSession(phone: string): Promise<BotSession> {
  const supabase = createAdminClient();
  if (!supabase) return { phone, state: "inicio", data: EMPTY };

  const { data } = await supabase
    .from("wa_sessions")
    .select("phone, state, data")
    .eq("phone", phone)
    .maybeSingle();

  const row = data as { phone: string; state: BotState; data: SessionData } | null;
  if (!row) return { phone, state: "inicio", data: EMPTY };

  return { phone, state: row.state, data: row.data ?? EMPTY };
}

export async function saveSession(
  phone: string,
  state: BotState,
  data: SessionData,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  await supabase
    .from("wa_sessions")
    .upsert(
      { phone, state, data, updated_at: new Date().toISOString() },
      { onConflict: "phone" },
    );
}

/** Termina la conversación (pedido confirmado o cancelado). */
export async function clearSession(phone: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from("wa_sessions").delete().eq("phone", phone);
}

/**
 * Borra conversaciones abandonadas. Se llama de vez en cuando desde el webhook
 * en lugar de montar un cron: el volumen es bajo y así no hay nada más que
 * mantener.
 */
export async function pruneSessions(): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.rpc("wa_prune_sessions");
}

/** Registra que el cliente escribió: abre la ventana de 24 h (mensajes gratis). */
export async function touchContact(
  phone: string,
  name?: string | null,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  await supabase.from("wa_contacts").upsert(
    {
      phone,
      ...(name ? { name } : {}),
      last_inbound_at: new Date().toISOString(),
      // Si escribió, es que quiere hablar: se le quita la baja.
      opted_out: false,
    },
    { onConflict: "phone" },
  );
}

export async function setOptOut(phone: string, value: boolean): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase
    .from("wa_contacts")
    .upsert({ phone, opted_out: value }, { onConflict: "phone" });
}
