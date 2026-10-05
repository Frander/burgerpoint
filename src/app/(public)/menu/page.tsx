import { connection } from "next/server";
import { getMenu } from "@/lib/menu";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getDeliveryPausedUntil, getHorario } from "@/lib/settings";
import { estaAbierto, lineasHorario } from "@/lib/hours";
import Storefront from "@/components/storefront/Storefront";

export default async function MenuPage() {
  // Abierto o cerrado depende de la hora: nunca se prerenderiza.
  await connection();
  const previewMode = !isSupabaseConfigured();
  const [menu, horario, pausa] = await Promise.all([
    getMenu(),
    getHorario(),
    previewMode ? null : getDeliveryPausedUntil(),
  ]);

  return (
    <Storefront
      menu={menu}
      previewMode={previewMode}
      abierto={previewMode || estaAbierto(horario)}
      sinDomicilio={pausa !== null}
      horario={horario.activo ? lineasHorario(horario) : []}
    />
  );
}
