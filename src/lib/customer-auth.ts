import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/whatsapp/phone";

/**
 * Sesión del cliente (la del staff es otra cosa: esa la lleva Supabase Auth).
 *
 * Va aparte a propósito. El código de verificación se manda por el WhatsApp del
 * negocio, así que de Supabase Auth solo usaríamos la sesión — y meter a los
 * clientes en `auth.users` fue justo lo que abrió el hueco que cerró 0014.
 *
 * Ni el código ni el token de sesión se guardan en claro: si alguien llegara a
 * ver la base, no puede entrar con la cuenta de nadie.
 */

const COOKIE = "bp_cliente";
const SESSION_DAYS = 60;
const OTP_MINUTES = 10;
const MAX_INTENTOS = 5;
/** Segundos mínimos entre un código y el siguiente para el mismo número. */
const REENVIO_SEGUNDOS = 60;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * El código son 6 dígitos: un millón de combinaciones se prueban en segundos.
 * Por eso no va con un hash pelón sino con HMAC y una llave que solo vive en el
 * servidor — con la base robada, los códigos siguen sin poder recuperarse.
 */
function hashCodigo(code: string, phone: string): string {
  const llave =
    process.env.CUSTOMER_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHmac("sha256", llave).update(`${phone}:${code}`).digest("hex");
}

/** Compara en tiempo constante: así no se puede adivinar el código midiendo. */
function igual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export interface OtpResult {
  ok: boolean;
  /** Solo en desarrollo con el simulador encendido: el código, para probar. */
  debugCode?: string;
  error?: string;
}

/**
 * Crea (o renueva) el código de un teléfono y devuelve el código en claro para
 * que quien llama lo mande por WhatsApp. Nunca se devuelve al navegador.
 */
export async function crearCodigo(
  rawPhone: string,
): Promise<{ ok: boolean; phone?: string; code?: string; error?: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "Ese número no parece válido." };

  const db = createAdminClient();
  if (!db) return { ok: false, error: "No se pudo conectar." };

  const { data } = await db
    .from("customer_otps")
    .select("sent_at")
    .eq("phone", phone)
    .maybeSingle();

  const previo = data as { sent_at: string } | null;
  if (previo) {
    const espera =
      REENVIO_SEGUNDOS * 1000 - (Date.now() - new Date(previo.sent_at).getTime());
    if (espera > 0) {
      return {
        ok: false,
        error: `Espera ${Math.ceil(espera / 1000)} segundos para pedir otro código.`,
      };
    }
  }

  // 6 dígitos, con ceros a la izquierda si toca.
  const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");

  const { error } = await db.from("customer_otps").upsert(
    {
      phone,
      code_hash: hashCodigo(code, phone),
      expires_at: new Date(Date.now() + OTP_MINUTES * 60 * 1000).toISOString(),
      attempts: 0,
      sent_at: new Date().toISOString(),
    },
    { onConflict: "phone" },
  );
  if (error) return { ok: false, error: "No se pudo generar el código." };

  return { ok: true, phone, code };
}

/**
 * Valida el código y, si está bien, deja al cliente dentro (cookie de sesión).
 * `name` solo se usa la primera vez, cuando el cliente aún no existe.
 */
export async function confirmarCodigo(
  rawPhone: string,
  code: string,
  name?: string | null,
): Promise<{ ok: boolean; phone?: string; error?: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "Ese número no parece válido." };

  const db = createAdminClient();
  if (!db) return { ok: false, error: "No se pudo conectar." };

  const { data } = await db
    .from("customer_otps")
    .select("code_hash, expires_at, attempts")
    .eq("phone", phone)
    .maybeSingle();

  const otp = data as
    | { code_hash: string; expires_at: string; attempts: number }
    | null;
  if (!otp) return { ok: false, error: "Pide un código primero." };
  if (new Date(otp.expires_at) < new Date()) {
    await db.from("customer_otps").delete().eq("phone", phone);
    return { ok: false, error: "El código ya venció. Pide otro." };
  }
  if (otp.attempts >= MAX_INTENTOS) {
    await db.from("customer_otps").delete().eq("phone", phone);
    return { ok: false, error: "Demasiados intentos. Pide un código nuevo." };
  }

  if (!igual(hashCodigo(code.trim(), phone), otp.code_hash)) {
    await db
      .from("customer_otps")
      .update({ attempts: otp.attempts + 1 })
      .eq("phone", phone);
    return { ok: false, error: "Ese código no es." };
  }

  // Código correcto: se quema y el cliente queda verificado.
  await db.from("customer_otps").delete().eq("phone", phone);

  const nombre = name?.trim();
  const { data: existente } = await db
    .from("customers")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();

  if (existente) {
    await db
      .from("customers")
      .update({
        verified_at: new Date().toISOString(),
        ...(nombre ? { name: nombre } : {}),
      })
      .eq("phone", phone);
  } else {
    await db.from("customers").insert({
      phone,
      name: nombre || "Cliente",
      verified_at: new Date().toISOString(),
    });
  }

  await abrirSesion(phone);
  return { ok: true, phone };
}

/** Crea la fila de sesión y deja la cookie en el navegador. */
async function abrirSesion(phone: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;

  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.from("customer_sessions").insert({
    token_hash: hash(token),
    phone,
    expires_at: expira.toISOString(),
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expira,
  });
}

/** Teléfono del cliente que está navegando, o null si no ha entrado. */
export async function clienteActual(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const db = createAdminClient();
  if (!db) return null;

  const { data } = await db
    .from("customer_sessions")
    .select("phone, expires_at")
    .eq("token_hash", hash(token))
    .maybeSingle();

  const sesion = data as { phone: string; expires_at: string } | null;
  if (!sesion) return null;
  if (new Date(sesion.expires_at) < new Date()) {
    await db.from("customer_sessions").delete().eq("token_hash", hash(token));
    return null;
  }
  return sesion.phone;
}

export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = createAdminClient();
    if (db) {
      await db.from("customer_sessions").delete().eq("token_hash", hash(token));
    }
  }
  jar.delete(COOKIE);
}
