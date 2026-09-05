import { createClient } from "@/lib/supabase/server";
import { requireSection } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatMoney } from "@/lib/format";
import {
  ORDER_STATUS_FILTERS,
  parseStatusFilter,
  statusFilterQuery,
} from "@/lib/orders";
import type { OrderWithItems } from "@/lib/types";
import OrderList from "@/components/admin/OrderList";

export const dynamic = "force-dynamic";

const TZ_OFFSET = "-06:00"; // America/Merida (sin horario de verano)

/** Hoy en formato YYYY-MM-DD en la zona del restaurante. */
function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    estado?: string;
    origen?: string;
  }>;
}) {
  await requireSection("pedidos");
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase para ver los pedidos.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const hoy = todayKey();
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(sp.desde ?? "") ? sp.desde! : hoy;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(sp.hasta ?? "") ? sp.hasta! : hoy;
  const estado = parseStatusFilter(sp.estado);
  const origen =
    sp.origen === "web" || sp.origen === "pdv" || sp.origen === "whatsapp"
      ? sp.origen
      : null;

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("*, order_items(*)")
    .gte("created_at", `${desde}T00:00:00${TZ_OFFSET}`)
    .lte("created_at", `${hasta}T23:59:59${TZ_OFFSET}`)
    .order("created_at", { ascending: false })
    .limit(500);
  if (estado) {
    const f = statusFilterQuery(estado);
    query = query.eq("status", f.status);
    if (f.delivery === "solo") query = query.eq("type", "delivery");
    if (f.delivery === "excluir") query = query.neq("type", "delivery");
  }
  if (origen) query = query.eq("origin", origen);

  const { data } = await query;
  const orders = (data ?? []) as OrderWithItems[];

  const validOrders = orders.filter((o) => o.status !== "cancelado");
  const totalVentas = validOrders.reduce((s, o) => s + Number(o.total), 0);

  const exportQs = new URLSearchParams({ desde, hasta });
  if (estado) exportQs.set("estado", estado);
  if (origen) exportQs.set("origen", origen);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Historial de pedidos</h1>

      {/* Filtros */}
      <form
        method="GET"
        className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-black/10 p-3 text-sm dark:border-white/10"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-black/50 dark:text-white/50">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={desde}
            className="rounded-md border border-black/15 px-2 py-1.5 dark:border-white/15 dark:bg-transparent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-black/50 dark:text-white/50">Hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta}
            className="rounded-md border border-black/15 px-2 py-1.5 dark:border-white/15 dark:bg-transparent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-black/50 dark:text-white/50">Estado</span>
          <select
            name="estado"
            defaultValue={estado ?? ""}
            className="rounded-md border border-black/15 px-2 py-1.5 dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Todos</option>
            {ORDER_STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-black/50 dark:text-white/50">Origen</span>
          <select
            name="origen"
            defaultValue={origen ?? ""}
            className="rounded-md border border-black/15 px-2 py-1.5 dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Todos</option>
            <option value="pdv">PDV</option>
            <option value="web">WEB</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Filtrar
        </button>
        <a
          href={`/admin/pedidos/export?${exportQs.toString()}`}
          className="rounded-md border border-green-600 px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400"
        >
          ⬇ Exportar CSV
        </a>
      </form>

      {/* Resumen */}
      <p className="mt-3 text-sm text-black/60 dark:text-white/60">
        {orders.length} pedidos ({validOrders.length} válidos) · Total:{" "}
        <span className="font-semibold text-black dark:text-white">
          {formatMoney(totalVentas)}
        </span>
      </p>

      <div className="mt-4">
        <OrderList orders={orders} />
      </div>
    </div>
  );
}
