import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { ORDER_STATUS_META, ORDER_TYPE_META } from "@/lib/orders";
import type { OrderFull } from "@/lib/types";

const TZ_OFFSET = "-06:00"; // America/Merida

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta el historial de pedidos filtrado como CSV (compatible con Excel). */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(params.get("desde") ?? "")
    ? params.get("desde")!
    : new Date().toISOString().slice(0, 10);
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(params.get("hasta") ?? "")
    ? params.get("hasta")!
    : desde;
  const estado = params.get("estado");
  const origen = params.get("origen");

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("*, order_items(*, order_item_modifiers(*)), order_payments(*)")
    .gte("created_at", `${desde}T00:00:00${TZ_OFFSET}`)
    .lte("created_at", `${hasta}T23:59:59${TZ_OFFSET}`)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (estado) query = query.eq("status", estado);
  if (origen && (origen === "web" || origen === "pdv" || origen === "whatsapp"))
    query = query.eq("origin", origen);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: string[] = [];
  rows.push(
    [
      "Folio",
      "Fecha",
      "Tipo",
      "Origen",
      "Estado",
      "Pago",
      "Métodos",
      "Cliente",
      "Teléfono",
      "Productos",
      "Envío",
      "Total",
      "Atendió",
    ].join(","),
  );

  for (const order of (data ?? []) as OrderFull[]) {
    const fecha = new Date(order.created_at).toLocaleString("es-MX", {
      timeZone: "America/Merida",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const productos = order.order_items
      .map((i) => `${i.quantity}x ${i.product_name}`)
      .join(" | ");
    const metodos = [...new Set(order.order_payments.map((p) => p.method))].join(
      " | ",
    );
    rows.push(
      [
        csvCell(order.code),
        csvCell(fecha),
        csvCell(ORDER_TYPE_META[order.type]?.label ?? order.type),
        csvCell(order.origin.toUpperCase()),
        csvCell(ORDER_STATUS_META[order.status]?.label ?? order.status),
        csvCell(order.payment_status === "pagado" ? "Pagado" : "No pagado"),
        csvCell(metodos),
        csvCell(order.customer_name),
        csvCell(order.customer_phone ?? ""),
        csvCell(productos),
        csvCell(Number(order.delivery_fee).toFixed(2)),
        csvCell(Number(order.total).toFixed(2)),
        csvCell(order.served_by ?? ""),
      ].join(","),
    );
  }

  // BOM para que Excel abra el CSV con acentos correctos.
  const csv = "\uFEFF" + rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-${desde}-a-${hasta}.csv"`,
    },
  });
}
