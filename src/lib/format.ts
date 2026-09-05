// Mismo formato que el menú digital de OlaClick: "MXN 49.00".
const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  currencyDisplay: "code",
});

/** Formatea un número como precio en pesos mexicanos. */
export function formatMoney(value: number): string {
  return mxn.format(value);
}

/** Zona del restaurante: Mérida no tiene horario de verano. */
export const TZ = "America/Merida";
const TZ_OFFSET = "-06:00";

/**
 * Inicio del día de hoy en la zona del restaurante, en ISO, para comparar
 * contra columnas `timestamptz` (el "hoy" del negocio, no el del servidor).
 */
export function inicioDelDia(): string {
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${hoy}T00:00:00${TZ_OFFSET}`;
}

/** Hora corta local ("11:54 a.m.") para las tarjetas del repartidor. */
export function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-MX", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
