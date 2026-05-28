import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const TZ = "America/Merida";

/** Clave de día YYYY-MM-DD en la zona horaria del restaurante. */
function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayLabel(key: string): string {
  // key es YYYY-MM-DD; lo mostramos como dd/mm + día de semana.
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

interface OrderRow {
  total: number;
  created_at: string;
  order_items: { product_name: string; quantity: number }[];
}

export default async function ReportesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase para ver los reportes.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("orders")
    .select("total, created_at, order_items(product_name, quantity)")
    .neq("status", "cancelado")
    .gte("created_at", since);

  const orders = (data ?? []) as OrderRow[];

  // Agregación por día.
  const byDay = new Map<string, { total: number; count: number }>();
  const topProducts = new Map<string, number>();
  for (const o of orders) {
    const key = dayKey(new Date(o.created_at));
    const agg = byDay.get(key) ?? { total: 0, count: 0 };
    agg.total += Number(o.total);
    agg.count += 1;
    byDay.set(key, agg);
    for (const item of o.order_items ?? []) {
      topProducts.set(
        item.product_name,
        (topProducts.get(item.product_name) ?? 0) + item.quantity,
      );
    }
  }

  // Últimos 7 días (incluye hoy).
  const last7: string[] = [];
  for (let i = 6; i >= 0; i--) {
    last7.push(dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  }
  const todayKey = last7[last7.length - 1];

  const today = byDay.get(todayKey) ?? { total: 0, count: 0 };
  const week = last7.reduce(
    (acc, key) => {
      const d = byDay.get(key);
      if (d) {
        acc.total += d.total;
        acc.count += d.count;
      }
      return acc;
    },
    { total: 0, count: 0 },
  );

  const maxDayTotal = Math.max(
    1,
    ...last7.map((k) => byDay.get(k)?.total ?? 0),
  );

  const top = [...topProducts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxQty = Math.max(1, ...top.map(([, q]) => q));

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Ventas (pedidos no cancelados) de los últimos 30 días.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card label="Ventas de hoy" value={formatMoney(today.total)} sub={`${today.count} pedidos`} />
        <Card label="Últimos 7 días" value={formatMoney(week.total)} sub={`${week.count} pedidos`} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Ventas por día</h2>
        <div className="space-y-2">
          {last7.map((key) => {
            const d = byDay.get(key) ?? { total: 0, count: 0 };
            const pct = Math.round((d.total / maxDayTotal) * 100);
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 capitalize text-black/60 dark:text-white/60">
                  {dayLabel(key)}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-black/5 dark:bg-white/10">
                  <div
                    className="h-full rounded bg-black dark:bg-white"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-medium">
                  {formatMoney(d.total)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Productos más vendidos</h2>
        {top.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Aún no hay ventas registradas.
          </p>
        ) : (
          <div className="space-y-2">
            {top.map(([name, qty]) => {
              const pct = Math.round((qty / maxQty) * 100);
              return (
                <div key={name} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 truncate text-black/70 dark:text-white/70">
                    {name}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-black/5 dark:bg-white/10">
                    <div
                      className="h-full rounded bg-black dark:bg-white"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-medium">
                    {qty}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 p-5 dark:border-white/10">
      <p className="text-sm text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-xs text-black/40 dark:text-white/40">{sub}</p>
    </div>
  );
}
