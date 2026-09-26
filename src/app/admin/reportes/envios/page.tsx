import { requireSection } from "@/lib/supabase/auth";
import EnviosReport from "@/components/reportes/EnviosReport";

export const dynamic = "force-dynamic";

/** Envíos de todos los repartidores, para saber cuánto pagarle a cada uno. */
export default async function EnviosAdminPage() {
  await requireSection("reportes");
  return <EnviosReport />;
}
