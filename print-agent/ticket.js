// Construye los tickets (cliente y comanda de cocina) en ESC/POS,
// replicando el formato de los recibos de OlaClick (ver docs/*.jpeg).

import { EscPos, wrap } from "./escpos.js";

const TYPE_LABEL = {
  en_local: "En el local",
  pickup: "Para llevar",
  delivery: "Domicilio",
  en_mesa: "Mesa",
};

const METHOD_LABEL = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

function money(n) {
  return `MXN ${Number(n).toFixed(2)}`;
}

function dateTime(iso) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Merida",
  });
}

function title(order, mesaName) {
  const base =
    order.type === "en_mesa"
      ? `Mesa${mesaName ? ` [${mesaName}]` : ""}`
      : (TYPE_LABEL[order.type] ?? order.type);
  return `${base} - ${order.origin === "pdv" ? "PDV" : "WEB"}`;
}

/** Ticket para el cliente (recibo completo con totales, pago y QR). */
export function clientTicket(order, { business, mesaName, columns = 48 }) {
  const t = new EscPos({ columns });

  t.align("center").bold(true).size(2).line(business.name).size(1).bold(false);
  for (const l of wrap(business.address, columns)) t.line(l);
  t.dashes();

  t.line(dateTime(order.created_at));
  t.bold(true).size(2);
  for (const l of wrap(title(order, mesaName), Math.floor(columns / 2))) t.line(l);
  t.size(1).bold(false);
  t.line(order.code);
  t.dashes();

  if (order.type === "delivery" || order.customer_phone) {
    t.line(order.customer_name || "");
    if (order.customer_phone) t.line(order.customer_phone);
    if (order.type === "delivery" && order.address) {
      for (const l of wrap(order.address, columns)) t.line(l);
    }
    t.dashes();
  }

  t.align("left");
  for (const item of order.order_items) {
    const lineTotal = money(item.unit_price * item.quantity);
    const name = `X${item.quantity} ${item.product_name}`;
    t.bold(true);
    if (name.length + lineTotal.length + 1 <= columns) t.row(name, lineTotal);
    else {
      for (const l of wrap(name, columns)) t.line(l);
      t.align("right").line(lineTotal).align("left");
    }
    t.bold(false);
    t.line(`  ${item.quantity} Unidad(es) ${Number(item.unit_price).toFixed(2)}`);
    for (const m of item.order_item_modifiers ?? []) {
      t.line(`  +1 ${m.modifier_name}`);
    }
    if (item.notes) for (const l of wrap(`  > ${item.notes}`, columns)) t.line(l);
  }
  if (order.notes) {
    for (const l of wrap(`Nota: ${order.notes}`, columns)) t.line(l);
  }
  t.dashes();

  const subtotal = Number(order.total) - Number(order.delivery_fee || 0);
  t.line(`Subtotal ${money(subtotal)}`);
  if (Number(order.delivery_fee) > 0) {
    t.line(`Precio de entrega ${money(order.delivery_fee)}`);
  }
  t.bold(true).size(2).line(`Total ${money(order.total)}`).size(1).bold(false);
  t.dashes();
  t.line("Este documento no tiene valor fiscal.");
  t.dashes();

  t.line(
    `Estado de pago: ${order.payment_status === "pagado" ? "Pagado" : "No pagado"}`,
  );
  t.bold(true).line(`Total a pagar: ${money(order.total)}`).bold(false);
  for (const p of order.order_payments ?? []) {
    let extra = "";
    if (p.received && Number(p.received) > Number(p.amount)) {
      extra = ` (recibido ${Number(p.received).toFixed(2)}, cambio ${(Number(p.received) - Number(p.amount)).toFixed(2)})`;
    }
    t.line(`${METHOD_LABEL[p.method] ?? p.method} ${Number(p.amount).toFixed(2)}${extra}`);
  }
  t.dashes();

  t.align("center");
  t.bold(true).line("Escanea el codigo para tu").line("proximo pedido.").bold(false);
  t.feed(1);
  t.qr(`${business.siteUrl}/menu`);
  t.feed(1);
  t.dashes();
  for (const l of wrap(
    "Califícanos en Google Maps y obtén una bebida GRATIS en tu próxima visita. ¡Tu opinión nos ayuda a mejorar!",
    columns,
  ))
    t.line(l);
  t.dashes();
  t.line(`${business.name} · Ticul, Yucatán`);

  t.cut();
  return t.buffer();
}

/** Comanda para cocina: grande, sin precios. */
export function kitchenTicket(order, { mesaName, columns = 48 }) {
  const t = new EscPos({ columns });

  t.align("center").line(dateTime(order.created_at));
  t.bold(true).size(2);
  for (const l of wrap(title(order, mesaName), Math.floor(columns / 2))) t.line(l);
  t.size(1).bold(false);
  t.line(order.code);
  if (order.served_by) t.line(`Atendio: ${order.served_by}`);
  if (order.customer_name) t.line(order.customer_name);
  t.dashes();

  t.align("left").size(2);
  for (const item of order.order_items) {
    t.bold(true);
    for (const l of wrap(`${item.quantity}x ${item.product_name}`, Math.floor(columns / 2)))
      t.line(l);
    t.bold(false);
    for (const m of item.order_item_modifiers ?? []) {
      for (const l of wrap(` +${m.modifier_name}`, Math.floor(columns / 2))) t.line(l);
    }
    if (item.notes) {
      for (const l of wrap(` >${item.notes}`, Math.floor(columns / 2))) t.line(l);
    }
  }
  t.size(1);
  if (order.notes) {
    t.dashes();
    for (const l of wrap(`NOTA: ${order.notes}`, columns)) t.line(l);
  }

  t.cut();
  return t.buffer();
}

/** Vista previa en texto plano (para dry-run y depuración). */
export function previewText(order, { business, mesaName }) {
  const lines = [];
  lines.push(business.name);
  lines.push(dateTime(order.created_at));
  lines.push(title(order, mesaName));
  lines.push(order.code);
  for (const item of order.order_items) {
    lines.push(`X${item.quantity} ${item.product_name}  ${money(item.unit_price * item.quantity)}`);
    for (const m of item.order_item_modifiers ?? []) lines.push(`  +1 ${m.modifier_name}`);
    if (item.notes) lines.push(`  > ${item.notes}`);
  }
  lines.push(`Total ${money(order.total)}`);
  lines.push(`Pago: ${order.payment_status}`);
  return lines.join("\n");
}
