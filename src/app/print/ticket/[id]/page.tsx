import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/auth";
import { BUSINESS } from "@/lib/business";
import { formatMoney } from "@/lib/format";
import { ORDER_TYPE_META, PAYMENT_METHOD_META } from "@/lib/orders";
import type { OrderFull } from "@/lib/types";
import AutoPrint from "./AutoPrint";

export const dynamic = "force-dynamic";

type TicketKind = "cliente" | "cocina";

function Dashes() {
  return (
    <div className="my-1.5 overflow-hidden whitespace-nowrap text-gray-500">
      {"- ".repeat(60)}
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Merida",
  });
}

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string; auto?: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const sp = await searchParams;
  const kind: TicketKind = sp.tipo === "cocina" ? "cocina" : "cliente";

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*, order_item_modifiers(*)), order_payments(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const order = data as OrderFull;

  // Nombre de la mesa (si aplica).
  let mesaName: string | null = null;
  if (order.mesa_id) {
    const { data: mesa } = await supabase
      .from("mesas")
      .select("name")
      .eq("id", order.mesa_id)
      .maybeSingle();
    mesaName = mesa?.name ?? null;
  }

  const qrDataUrl =
    kind === "cliente"
      ? await QRCode.toDataURL(`${BUSINESS.siteUrl}/menu`, {
          margin: 0,
          width: 200,
        })
      : null;

  const typeMeta = ORDER_TYPE_META[order.type];
  const title =
    order.type === "en_mesa"
      ? `Mesa${mesaName ? ` [${mesaName}]` : ""}`
      : typeMeta.label;
  const subtotal = Number(order.total) - Number(order.delivery_fee);
  const paid = order.order_payments.reduce((s, p) => s + Number(p.amount), 0);

  const itemsBlock = (big: boolean) => (
    <div className={big ? "text-[15px]" : "text-[13px]"}>
      {order.order_items.map((item) => (
        <div key={item.id} className="mb-1">
          <div className="flex justify-between gap-2 font-bold">
            <span>
              X{item.quantity} {item.product_name}
            </span>
            {!big && (
              <span className="whitespace-nowrap">
                {formatMoney(item.unit_price * item.quantity)}
              </span>
            )}
          </div>
          {!big && (
            <div className="pl-4 text-gray-800">
              {item.quantity} Unidad(es) {formatMoney(item.unit_price)}
            </div>
          )}
          {(item.order_item_modifiers ?? []).map((m) => (
            <div key={m.id} className="pl-4">
              +1 {m.modifier_name}
            </div>
          ))}
          {item.notes && <div className="pl-4 italic">✎ {item.notes}</div>}
        </div>
      ))}
    </div>
  );

  return (
    <main className="bg-white text-black">
      {/* Impresión térmica 80mm: sin márgenes de página */}
      <style>{`
        @page { size: 80mm auto; margin: 0; }
        @media print { body { margin: 0; } }
      `}</style>

      <AutoPrint enabled={sp.auto !== "0"} />

      <div className="mx-auto w-[72mm] pb-6 pt-2 font-sans leading-snug">
        {/* Encabezado */}
        <div className="text-center">
          {kind === "cliente" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={BUSINESS.logoPath}
              alt=""
              className="mx-auto mb-1 h-20 w-20 object-cover"
            />
          )}
          <h1 className="text-2xl font-extrabold">{BUSINESS.name}</h1>
          {kind === "cliente" && (
            <p className="text-[12px]">{BUSINESS.address}</p>
          )}
        </div>

        <Dashes />

        {/* Tipo y folio */}
        <div className="text-center">
          <p className="text-[13px]">{formatDateTime(order.created_at)}</p>
          <p className="text-2xl font-extrabold leading-tight">
            {title} - {order.origin === "pdv" ? "PDV" : "WEB"}
          </p>
          <p className="mt-1 text-[12px]">{order.code}</p>
          {kind === "cocina" && order.served_by && (
            <p className="text-[12px]">Atendió: {order.served_by}</p>
          )}
        </div>

        <Dashes />

        {/* Cliente (domicilio / datos capturados) */}
        {kind === "cliente" &&
          (order.type === "delivery" ||
            order.customer_phone ||
            order.customer_name) && (
            <>
              <div className="text-center text-[13px]">
                <p>{order.customer_name}</p>
                {order.customer_phone && <p>{order.customer_phone}</p>}
                {order.type === "delivery" && order.address && (
                  <p>{order.address}</p>
                )}
              </div>
              <Dashes />
            </>
          )}

        {/* Líneas */}
        {itemsBlock(kind === "cocina")}

        {order.notes && (
          <p className="mt-1 text-[13px] italic">Nota: {order.notes}</p>
        )}

        {kind === "cliente" && (
          <>
            <Dashes />
            <div className="text-[13px]">
              <p>Subtotal {formatMoney(subtotal)}</p>
              {Number(order.delivery_fee) > 0 && (
                <p>Precio de entrega {formatMoney(Number(order.delivery_fee))}</p>
              )}
            </div>
            <p className="mt-1 text-2xl font-extrabold">
              Total {formatMoney(Number(order.total))}
            </p>

            <Dashes />
            <p className="text-[12px] italic">
              Este documento no tiene valor fiscal.
            </p>
            <Dashes />

            <div className="text-[13px]">
              <p>
                Estado de pago:{" "}
                {order.payment_status === "pagado" ? "Pagado" : "No pagado"}
              </p>
              <p className="font-bold">
                Total a pagar: {formatMoney(Number(order.total))}
              </p>
              {order.order_payments.map((p) => (
                <p key={p.id}>
                  {PAYMENT_METHOD_META[p.method].label}{" "}
                  {formatMoney(Number(p.amount))}
                  {p.received && Number(p.received) > Number(p.amount)
                    ? ` · Recibido ${formatMoney(Number(p.received))} · Cambio ${formatMoney(Number(p.received) - Number(p.amount))}`
                    : ""}
                </p>
              ))}
              {paid > 0 && paid < Number(order.total) && (
                <p>Pagado hasta ahora: {formatMoney(paid)}</p>
              )}
            </div>

            {qrDataUrl && (
              <>
                <Dashes />
                <p className="text-center text-[13px] font-bold">
                  Escanea el código para tu próximo pedido.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="QR del menú"
                  className="mx-auto my-2 h-[38mm] w-[38mm]"
                />
              </>
            )}

            <Dashes />
            <p className="text-center text-[12px]">
              Califícanos en Google Maps y obtén una bebida GRATIS en tu
              próxima visita. ¡Tu opinión nos ayuda a mejorar!
            </p>
            <Dashes />
            <p className="text-center text-[12px]">
              {BUSINESS.name} · Ticul, Yucatán
            </p>
          </>
        )}
      </div>
    </main>
  );
}
