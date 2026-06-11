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
