import { requireSection } from "@/lib/supabase/auth";
import EnviosReport from "@/components/reportes/EnviosReport";

export const dynamic = "force-dynamic";

/** Lo que lleva ganado el repartidor. Solo ve lo suyo (RLS de 0011 + el filtro). */
export default async function MisEnviosPage() {
  const profile = await requireSection("entregas");
  return <EnviosReport courierId={profile.id} />;
}
