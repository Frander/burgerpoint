import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCouriers } from "@/lib/couriers";
import { formatMoney } from "@/lib/format";

/**
 * Reporte de envíos: lo que cada repartidor ganó por sus entregas. Lo usan dos
 * pantallas —la del repartidor (solo lo suyo) y la del admin (todos)— para que
 * cada rol lo vea dentro de su propia interfaz.
 */

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
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/**
 * Lunes de la semana a la que pertenece `key`, también como YYYY-MM-DD.
 * Se trabaja con claves de texto en vez de fechas para no pelear con la zona
 * horaria: comparar "2026-09-07" <= "2026-09-12" ya da el rango correcto.
 */
function mondayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const diff = (date.getUTCDay() + 6) % 7; // domingo=0 -> 6
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

interface Entrega {
  delivery_fee: number;
  closed_at: string;
  courier_id: string | null;
}

interface Totales {
  hoy: { envios: number; ganado: number };
  semana: { envios: number; ganado: number };
  mes: { envios: number; ganado: number };
  porDia: { key: string; envios: number; ganado: number }[];
}

function acumular(entregas: Entrega[], hoyKey: string): Totales {
  const lunes = mondayKey(hoyKey);
  const mes = hoyKey.slice(0, 7);

  const totales: Totales = {
    hoy: { envios: 0, ganado: 0 },
    semana: { envios: 0, ganado: 0 },
    mes: { envios: 0, ganado: 0 },
    porDia: [],
  };
  const porDia = new Map<string, { envios: number; ganado: number }>();

  for (const e of entregas) {
    const key = dayKey(new Date(e.closed_at));
    const ganado = Number(e.delivery_fee) || 0;

    if (key === hoyKey) {
      totales.hoy.envios++;
      totales.hoy.ganado += ganado;
    }
    if (key >= lunes && key <= hoyKey) {
      totales.semana.envios++;
      totales.semana.ganado += ganado;
    }
    if (key.startsWith(mes)) {
      totales.mes.envios++;
      totales.mes.ganado += ganado;
      const dia = porDia.get(key) ?? { envios: 0, ganado: 0 };
      dia.envios++;
      dia.ganado += ganado;
      porDia.set(key, dia);
    }
  }

  totales.porDia = [...porDia.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.key.localeCompare(a.key));
  return totales;
}

function Tarjeta({
  titulo,
  datos,
}: {
  titulo: string;
  datos: { envios: number; ganado: number };
}) {
  return (
    <div className="rounded-xl border border-black/10 px-4 py-3 dark:border-white/10">
      <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
        {titulo}
      </p>
      <p className="mt-1 text-2xl font-bold">{formatMoney(datos.ganado)}</p>
      <p className="text-xs text-black/50 dark:text-white/50">
        {datos.envios} {datos.envios === 1 ? "entrega" : "entregas"}
      </p>
    </div>
  );
}

/** Ventana de consulta y día de hoy, fuera del render (son datos del reloj). */
function ventana(): { desde: string; hoyKey: string } {
  const ahora = Date.now();
  return {
    // 45 días cubren de sobra el mes en curso; lo viejo no se pinta.
    desde: new Date(ahora - 45 * 24 * 60 * 60 * 1000).toISOString(),
    hoyKey: dayKey(new Date(ahora)),
  };
}

export default async function EnviosReport({
  courierId,
}: {
  /** Repartidor cuyo reporte se muestra; sin él, se ven todos (admin). */
  courierId?: string;
}) {
  const esRepartidor = Boolean(courierId);

  if (!isSupabaseConfigured()) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        Conecta Supabase para ver el reporte.
      </p>
    );
  }

  const supabase = await createClient();
  const { desde, hoyKey } = ventana();
  let query = supabase
    .from("orders")
    .select("delivery_fee, closed_at, courier_id")
    .eq("status", "entregado")
    .not("closed_at", "is", null)
    .gte("closed_at", desde);
  // Las políticas RLS ya encierran al repartidor en sus pedidos; el filtro es
  // para que el admin no vea aquí una mezcla de todos sin querer.
  if (courierId) query = query.eq("courier_id", courierId);

  const { data } = await query;
  const entregas = (data ?? []) as Entrega[];
  const totales = acumular(entregas, hoyKey);

  // Para el admin: el desglose por repartidor.
  const couriers = esRepartidor ? [] : await getCouriers();
  const nombres = new Map(couriers.map((c) => [c.id, c.name]));
  const porRepartidor = esRepartidor
    ? []
    : [
        ...new Set(entregas.map((e) => e.courier_id).filter(Boolean)),
      ].map((id) => ({
        id: id as string,
        nombre: nombres.get(id as string) ?? `Repartidor ${String(id).slice(0, 4)}`,
        totales: acumular(
          entregas.filter((e) => e.courier_id === id),
          hoyKey,
        ),
      }));

  return (
    <div className={esRepartidor ? "" : "max-w-3xl"}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          {esRepartidor ? "Mis envíos" : "Envíos por repartidor"}
        </h1>
        <Link
          href={esRepartidor ? "/repartidor" : "/admin/reportes"}
          className="text-sm text-black/60 hover:underline dark:text-white/60"
        >
          ← Volver
        </Link>
      </div>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Se cuenta el envío de cada pedido entregado, con lo que se cobró en ese
        pedido.
        {!esRepartidor &&
          " Los totales de arriba son de todo el negocio e incluyen entregas sin repartidor asignado; la tabla reparte solo lo que sí tiene dueño."}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tarjeta titulo="Hoy" datos={totales.hoy} />
        <Tarjeta titulo="Esta semana" datos={totales.semana} />
        <Tarjeta titulo="Este mes" datos={totales.mes} />
      </div>

      {!esRepartidor && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Por repartidor</h2>
          {porRepartidor.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              Nadie ha entregado pedidos este mes.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
                  <tr>
                    <th className="py-2">Repartidor</th>
                    <th className="py-2 text-right">Hoy</th>
                    <th className="py-2 text-right">Semana</th>
                    <th className="py-2 text-right">Mes</th>
                  </tr>
                </thead>
                <tbody>
                  {porRepartidor.map((r) => (
                    <tr key={r.id} className="border-t border-black/5 dark:border-white/10">
                      <td className="py-2">{r.nombre}</td>
                      <td className="py-2 text-right">
                        {formatMoney(r.totales.hoy.ganado)}
                        <span className="ml-1 text-xs text-black/40 dark:text-white/40">
                          ({r.totales.hoy.envios})
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {formatMoney(r.totales.semana.ganado)}
                        <span className="ml-1 text-xs text-black/40 dark:text-white/40">
                          ({r.totales.semana.envios})
                        </span>
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatMoney(r.totales.mes.ganado)}
                        <span className="ml-1 text-xs text-black/40 dark:text-white/40">
                          ({r.totales.mes.envios})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Día por día (este mes)</h2>
        {totales.porDia.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Todavía no hay entregas este mes.
          </p>
        ) : (
          <ul className="space-y-1">
            {totales.porDia.map((d) => (
              <li
                key={d.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
              >
                <span className="capitalize">{dayLabel(d.key)}</span>
                <span className="text-black/50 dark:text-white/50">
                  {d.envios} {d.envios === 1 ? "entrega" : "entregas"}
                </span>
                <span className="font-medium">{formatMoney(d.ganado)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
