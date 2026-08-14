import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la llave `service_role`: ignora RLS y no depende de que haya
 * sesión. Se usa para lo que hace el servidor por su cuenta (WhatsApp: bitácora
 * de mensajes y pedidos creados por el bot, donde no hay usuario logueado).
 *
 * NUNCA importar esto desde un componente de cliente: la llave da acceso total.
 * `server-only` hace que el build falle si eso llega a pasar.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isAdminClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
