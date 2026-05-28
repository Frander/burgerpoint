const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

/** Formatea un número como precio en pesos mexicanos. */
export function formatMoney(value: number): string {
  return mxn.format(value);
}
