/**
 * Indica si Supabase ya tiene credenciales configuradas en el entorno.
 * Permite que el storefront funcione en "modo preview" con datos de ejemplo
 * mientras no se conecta un proyecto real.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
