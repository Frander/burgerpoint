import { requireSection } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { getStaffUsers } from "@/lib/staff";
import UserManager from "@/components/admin/UserManager";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const yo = await requireSection("usuarios");

  if (!isSupabaseConfigured() || !isAdminClientConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code> en el entorno. Dar de alta
          usuarios necesita la llave de servicio de Supabase (Settings → API).
        </p>
      </div>
    );
  }

  const users = await getStaffUsers();
  return <UserManager users={users} currentUserId={yo.id} />;
}
