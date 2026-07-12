"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/auth";
import type { CashMovementType, PaymentMethod } from "@/lib/types";

interface Result {
  ok: boolean;
  error?: string;
}

function revalidate() {
  revalidatePath("/admin/caja");
}

/** Abre una caja con el efectivo inicial. Solo puede haber una abierta. */
export async function openSession(openingAmount: number): Promise<Result> {
  const profile = await requireProfile();
  if (openingAmount < 0) return { ok: false, error: "Monto inválido." };

  const supabase = await createClient();
  const { data: open } = await supabase
    .from("cash_sessions")
    .select("id")
    .is("closed_at", null)
    .limit(1)
    .maybeSingle();
  if (open) return { ok: false, error: "Ya hay una caja abierta." };

  const { error } = await supabase.from("cash_sessions").insert({
    opening_amount: openingAmount,
    opened_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Registra un ingreso o gasto manual en la caja abierta. */
export async function addMovement(input: {
  type: CashMovementType;
  amount: number;
  method: PaymentMethod;
  category?: string;
  notes?: string;
}): Promise<Result> {
  const profile = await requireProfile();
  if (!(input.amount > 0)) return { ok: false, error: "El monto debe ser mayor a 0." };

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("cash_sessions")
    .select("id")
    .is("closed_at", null)
    .limit(1)
    .maybeSingle();
  if (!session) return { ok: false, error: "No hay una caja abierta." };

  const { error } = await supabase.from("cash_movements").insert({
    session_id: session.id,
    type: input.type,
    amount: input.amount,
    method: input.method,
    category: input.category?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Cierra la caja abierta con el efectivo contado (arqueo). */
export async function closeSession(
  sessionId: string,
  countedAmount: number,
  expectedAmount: number,
  notes?: string,
): Promise<Result> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cash_sessions")
    .update({
      closed_at: new Date().toISOString(),
      closed_by: profile.id,
      closing_amount: countedAmount,
      expected_amount: expectedAmount,
      notes: notes?.trim() || null,
    })
    .eq("id", sessionId)
    .is("closed_at", null);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
