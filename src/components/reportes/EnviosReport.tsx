import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCouriers } from "@/lib/couriers";
import { formatMoney } from "@/lib/format";

/**
 * Reporte de envíos: lo que cada repartidor ganó por sus entregas y, aparte,
 * cuánto sumaron los pedidos que llevó (sin el envío). Lo usan dos
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
  total: number;
  delivery_fee: number;
  created_at: string;
  closed_at: string | null;
  courier_id: string | null;
}

/** `ganado` es lo de los envíos; `pedidos`, lo de la comida (sin envío). */
interface Suma {
  envios: number;
  ganado: number;
  pedidos: number;
}

interface Totales {
  hoy: Suma;
  semana: Suma;
  mes: Suma;
  porDia: ({ key: string } & Suma)[];
}

const vacia = (): Suma => ({ envios: 0, ganado: 0, pedidos: 0 });

function sumar(s: Suma, ganado: number, pedido: number) {
  s.envios++;
  s.ganado += ganado;
  s.pedidos += pedido;
}

function acumular(entregas: Entrega[], hoyKey: string): Totales {
  const lunes = mondayKey(hoyKey);
  const mes = hoyKey.slice(0, 7);

  const totales: Totales = {
    hoy: vacia(),
    semana: vacia(),
    mes: vacia(),
    porDia: [],
  };
  const porDia = new Map<string, Suma>();

  for (const e of entregas) {
    // Los pedidos viejos entregados desde cocina no traen hora de cierre; se
    // cuentan en el día en que se pidieron para no dejarlos fuera.
    const key = dayKey(new Date(e.closed_at ?? e.created_at));
    const ganado = Number(e.delivery_fee) || 0;
    // `total` ya trae el envío sumado (y el cupón restado): el pedido como tal
    // es lo que queda al quitarle el envío.
    const pedido = Math.max(0, (Number(e.total) || 0) - ganado);

    if (key === hoyKey) sumar(totales.hoy, ganado, pedido);
    if (key >= lunes && key <= hoyKey) sumar(totales.semana, ganado, pedido);
    if (key.startsWith(mes)) {
      sumar(totales.mes, ganado, pedido);
      const dia = porDia.get(key) ?? vacia();
      sumar(dia, ganado, pedido);
      porDia.set(key, dia);
    }
  }

  totales.porDia = [...porDia.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.key.localeCompare(a.key));
  return totales;
}

function Tarjeta({ titulo, datos }: { titulo: string; datos: Suma }) {
  return (
    <div className="rounded-xl border border-black/10 px-4 py-3 dark:border-white/10">
      <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
        {titulo} · {datos.envios} {datos.envios === 1 ? "entrega" : "entregas"}
      </p>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-black/60 dark:text-white/60">Pedidos</dt>
          <dd className="font-semibold">{formatMoney(datos.pedidos)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-black/60 dark:text-white/60">Envíos</dt>
          <dd className="text-lg font-bold">{formatMoney(datos.ganado)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t border-black/10 pt-1 dark:border-white/10">
          <dt className="text-black/60 dark:text-white/60">Total cobrado</dt>
          <dd>{formatMoney(datos.pedidos + datos.ganado)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Celda de la tabla del admin: envío arriba, pedidos debajo. */
function Celda({ datos, fuerte }: { datos: Suma; fuerte?: boolean }) {
  return (
    <td className={`py-2 text-right ${fuerte ? "font-medium" : ""}`}>
      {formatMoney(datos.ganado)}
      <span className="ml-1 text-xs text-black/40 dark:text-white/40">
        ({datos.envios})
      </span>
      <span className="block text-xs font-normal text-black/50 dark:text-white/50">
        Pedidos {formatMoney(datos.pedidos)}
      </span>
    </td>
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
    .select("total, delivery_fee, created_at, closed_at, courier_id")
    .eq("status", "entregado")
    // Solo domicilios: un pedido de mesa o para llevar también termina en
    // "entregado", pero no es un envío.
    .eq("type", "delivery")
    .gte("created_at", desde);
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
        De cada pedido a domicilio entregado se separa lo del pedido (la comida,
        ya con descuentos) y lo del envío.
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
                    {/* Cada celda: envíos (entregas) y debajo los pedidos. */}
                    <th className="py-2 text-right">Hoy</th>
                    <th className="py-2 text-right">Semana</th>
                    <th className="py-2 text-right">Mes</th>
                  </tr>
                </thead>
                <tbody>
                  {porRepartidor.map((r) => (
                    <tr key={r.id} className="border-t border-black/5 dark:border-white/10">
                      <td className="py-2">{r.nombre}</td>
                      <Celda datos={r.totales.hoy} />
                      <Celda datos={r.totales.semana} />
                      <Celda datos={r.totales.mes} fuerte />
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
                <span className="min-w-0">
                  <span className="capitalize">{dayLabel(d.key)}</span>
                  <span className="block text-xs text-black/50 dark:text-white/50">
                    {d.envios} {d.envios === 1 ? "entrega" : "entregas"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-xs text-black/50 dark:text-white/50">
                    Pedidos {formatMoney(d.pedidos)}
                  </span>
                  <span className="font-medium">
                    Envíos {formatMoney(d.ganado)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
