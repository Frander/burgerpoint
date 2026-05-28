import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para usar en Componentes de Cliente ("use client").
 * Usa las variables NEXT_PUBLIC_* que viajan al navegador.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
