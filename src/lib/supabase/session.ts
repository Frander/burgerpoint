import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Refresca la sesión de Supabase y reescribe las cookies en cada request.
 * Se invoca desde `proxy.ts`. Además protege las rutas privadas (/admin y
 * /repartidor): si no hay usuario autenticado, redirige a /login.
 */
export async function updateSession(request: NextRequest) {
  // Si /auth/confirm no está en las Redirect URLs de Supabase, el enlace del
  // correo cae en la Site URL (la portada) con ?code=. Se reenvía a donde toca.
  if (
    request.nextUrl.pathname === "/" &&
    request.nextUrl.searchParams.has("code")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirm";
    url.searchParams.set("next", "/login/nueva");
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  // Sin credenciales (modo preview): no hacemos nada.
  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: no insertar lógica entre createServerClient y getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const privada =
    pathname.startsWith("/admin") || pathname.startsWith("/repartidor");
  if (privada && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
