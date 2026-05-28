import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// En Next.js 16 el antiguo `middleware` se llama `proxy` (runtime nodejs).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Ejecuta en todas las rutas excepto archivos estáticos e imágenes:
     * - _next/static, _next/image, favicon, y archivos con extensión.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
