import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Courier } from "@/lib/types";

/**
 * Repartidores disponibles para asignar, ordenados por nombre.
 *
 * `profiles` no guarda el correo, así que cuando alguien no tiene `full_name`
 * se completa con su correo vía la llave de servicio; sin ella se muestra un
 * nombre provisional en vez de dejar la lista con etiquetas vacías.
 */
export async function getCouriers(): Promise<Courier[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "repartidor");

  // Mientras no se corra 0011_repartidor.sql el rol no existe en el enum y
  // Postgres rechaza la consulta: el PDV sigue funcionando, solo que sin
  // repartidores que asignar.
  if (error) {
    console.warn("[couriers] no se pudo listar repartidores:", error.message);
    return [];
  }

  const rows = (data ?? []) as { id: string; full_name: string | null }[];
  if (rows.length === 0) return [];

  const faltantes = rows.filter((r) => !r.full_name?.trim());
  const correos = new Map<string, string>();
  if (faltantes.length > 0) {
    const admin = createAdminClient();
    if (admin) {
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
      for (const u of users?.users ?? []) {
        if (u.email) correos.set(u.id, u.email);
      }
    }
  }

  return rows
    .map((r) => ({
      id: r.id,
      name:
        r.full_name?.trim() ||
        correos.get(r.id) ||
        `Repartidor ${r.id.slice(0, 4)}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
