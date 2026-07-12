"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/auth";

interface Result {
  ok: boolean;
  error?: string;
}

function revalidate() {
  revalidatePath("/admin/mesas");
  revalidatePath("/admin/pdv");
}

export async function createSala(
  name: string,
  sortOrder: number,
): Promise<Result> {
  await requireProfile();
  if (!name.trim()) return { ok: false, error: "Falta el nombre de la sala." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("salas")
    .insert({ name: name.trim(), sort_order: sortOrder });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateSala(
  id: string,
  fields: { name?: string; active?: boolean; sort_order?: number },
): Promise<Result> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("salas").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteSala(id: string): Promise<Result> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("salas").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function createMesa(
  salaId: string,
  name: string,
  sortOrder: number,
): Promise<Result> {
  await requireProfile();
  if (!name.trim()) return { ok: false, error: "Falta el nombre de la mesa." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("mesas")
    .insert({ sala_id: salaId, name: name.trim(), sort_order: sortOrder });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateMesa(
  id: string,
  fields: { name?: string; active?: boolean; sort_order?: number },
): Promise<Result> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("mesas").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteMesa(id: string): Promise<Result> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("mesas").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
