import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de los enlaces que manda Supabase por correo (recuperar contraseña).
 * Convierte el enlace en sesión y manda a `next`. Acepta los dos formatos:
 * - `?code=`: el de la plantilla por defecto ({{ .ConfirmationURL }}, PKCE).
 * - `?token_hash=&type=`: el de una plantilla propia con {{ .TokenHash }}.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Solo rutas internas: que el enlace no sirva para rebotar a otro sitio.
  const nextParam = searchParams.get("next") ?? "/login/nueva";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : "/login/nueva";

  const supabase = await createClient();
  let ok = false;

  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  return NextResponse.redirect(
    new URL(ok ? next : "/login?error=enlace", origin),
  );
}
