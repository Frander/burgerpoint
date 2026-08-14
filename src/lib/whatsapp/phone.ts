/**
 * Normaliza un teléfono al formato que espera Meta: solo dígitos, con lada de
 * país y sin '+'. Los teléfonos de `orders.customer_phone` los escribe gente a
 * mano, así que llegan como "999 123 4567", "+52 999...", "01 999..." etc.
 *
 * Devuelve null si no parece un número utilizable, para no gastar una plantilla
 * mandándosela a un número inventado.
 */
export function normalizePhone(
  raw: string | null | undefined,
  countryCode = "52",
): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Prefijo internacional escrito como 00 (00 52 …).
  if (digits.startsWith("00")) digits = digits.slice(2);

  // México: "01" y "045"/"044" son prefijos de marcación antiguos que ya no
  // forman parte del número.
  if (countryCode === "52") {
    if (digits.startsWith("045") || digits.startsWith("044")) {
      digits = digits.slice(3);
    } else if (digits.startsWith("01") && digits.length > 10) {
      digits = digits.slice(2);
    }
  }

  // Número local sin lada de país.
  if (digits.length === 10) digits = `${countryCode}${digits}`;

  // Un número de 8 dígitos o menos no es un celular: probablemente es basura.
  if (digits.length < 11 || digits.length > 15) return null;

  return digits;
}

/** Oculta el centro del número para poder registrarlo en logs sin exponerlo. */
export function maskPhone(phone: string): string {
  if (phone.length <= 6) return "***";
  return `${phone.slice(0, 3)}***${phone.slice(-3)}`;
}
