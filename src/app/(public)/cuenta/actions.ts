"use server";

import { revalidatePath } from "next/cache";
import {
  cerrarSesion,
  clienteActual,
  confirmarCodigo,
  crearCodigo,
} from "@/lib/customer-auth";
import { redeemCoupon } from "@/lib/loyalty";
import { sendAccessCode } from "@/lib/whatsapp/notify";

export interface CuentaResult {
  ok: boolean;
  error?: string;
  /** Aviso que no es un error: el código se creó pero no se pudo entregar. */
  warning?: string;
  code?: string;
}

/** Paso 1: el cliente escribe su teléfono y le llega un código por WhatsApp. */
export async function pedirCodigo(phone: string): Promise<CuentaResult> {
  const res = await crearCodigo(phone);
  if (!res.ok || !res.code || !res.phone) {
    return { ok: false, error: res.error ?? "No se pudo generar el código." };
  }

  const enviado = await sendAccessCode(res.phone, res.code);
  if (!enviado) {
    // Pasa mientras el número de WhatsApp del negocio no esté conectado. El
    // código es válido: alguien del local puede dictarlo.
    console.warn("[cuenta] no se pudo enviar el código por WhatsApp");
    return {
      ok: true,
      warning:
        "No pudimos mandarte el código por WhatsApp. Pídelo en el restaurante.",
    };
  }
  return { ok: true };
}

/** Paso 2: valida el código y abre la sesión. */
export async function entrar(
  phone: string,
  code: string,
  name: string,
): Promise<CuentaResult> {
  if (!code.trim()) return { ok: false, error: "Escribe el código." };

  const res = await confirmarCodigo(phone, code, name);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/cuenta");
  return { ok: true };
}

export async function salir(): Promise<CuentaResult> {
  await cerrarSesion();
  revalidatePath("/cuenta");
  return { ok: true };
}

/** Cambia puntos por un cupón de descuento. */
export async function canjear(): Promise<CuentaResult> {
  const phone = await clienteActual();
  if (!phone) return { ok: false, error: "Vuelve a entrar con tu número." };

  const res = await redeemCoupon(phone);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/cuenta");
  return { ok: true, code: res.code };
}
