import { connection } from "next/server";
import { getMenu } from "@/lib/menu";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getHorario } from "@/lib/settings";
import { estaAbierto, lineasHorario } from "@/lib/hours";
import Storefront from "@/components/storefront/Storefront";

export default async function MenuPage() {
  // Abierto o cerrado depende de la hora: nunca se prerenderiza.
  await connection();
  const previewMode = !isSupabaseConfigured();
  const [menu, horario] = await Promise.all([getMenu(), getHorario()]);

  return (
    <Storefront
      menu={menu}
      previewMode={previewMode}
      abierto={previewMode || estaAbierto(horario)}
      horario={horario.activo ? lineasHorario(horario) : []}
    />
  );
}
