import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { canAccess } from "@/lib/roles";
import { WHATSAPP } from "@/lib/whatsapp/config";

/**
 * Foto, audio o archivo que mandó un cliente, para verlo en la bandeja.
 *
 * Meta no da un enlace público: con el id del adjunto se pide una URL que dura
 * 5 minutos y que además exige el token. Por eso el panel no puede enlazarla
 * directo y pasa por aquí. Se busca por el id de *nuestra* fila (no por el id
 * de Meta) para que nadie use esta ruta de proxy hacia cualquier adjunto.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canAccess(profile.role, ["whatsapp"])) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("wa_messages")
    .select("payload")
    .eq("id", id)
    .maybeSingle();

  const media = (data as { payload: { media?: { id?: string; filename?: string } } | null } | null)
    ?.payload?.media;
  if (!media?.id) {
    return NextResponse.json({ error: "Ese mensaje no trae archivo" }, { status: 404 });
  }

  const auth = { Authorization: `Bearer ${WHATSAPP.token}` };

  const info = await fetch(
    `https://graph.facebook.com/${WHATSAPP.graphVersion}/${media.id}`,
    { headers: auth, cache: "no-store" },
  );
  const meta = (await info.json().catch(() => null)) as
    | { url?: string; mime_type?: string; error?: { message?: string } }
    | null;
  if (!info.ok || !meta?.url) {
    // Meta borra los adjuntos a los 30 días; después de eso ya no hay nada.
    return NextResponse.json(
      { error: meta?.error?.message ?? "Meta ya no tiene este archivo" },
      { status: 404 },
    );
  }

  const archivo = await fetch(meta.url, { headers: auth, cache: "no-store" });
  if (!archivo.ok || !archivo.body) {
    return NextResponse.json({ error: "No se pudo descargar de Meta" }, { status: 502 });
  }

  const headers: Record<string, string> = {
    "Content-Type": meta.mime_type ?? archivo.headers.get("content-type") ?? "application/octet-stream",
    // El archivo no cambia nunca: que el navegador lo guarde y no pida otra vez a Meta.
    "Cache-Control": "private, max-age=86400, immutable",
  };
  if (media.filename) {
    headers["Content-Disposition"] = `inline; filename*=UTF-8''${encodeURIComponent(media.filename)}`;
  }

  return new Response(archivo.body, { headers });
}
