/**
 * Horario de atención (Ajustes → Horario). Todo se calcula en hora de Yucatán
 * (America/Merida, UTC-6 todo el año, sin horario de verano), sin importar la
 * zona del servidor de Vercel ni la del navegador.
 *
 * Sin base de datos a propósito: lo usan el servidor (bot, pedidos) y la
 * pantalla de Ajustes por igual.
 */

export const TIME_ZONE = "America/Merida";

/** Domingo primero, como `Date.getDay()`. */
export const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export interface DiaHorario {
  abierto: boolean;
  /** "13:00" (24 h). */
  desde: string;
  /** "23:00". Si es menor o igual que `desde`, cierra pasada la medianoche. */
  hasta: string;
}

export interface Horario {
  /** Apagado = se atiende siempre, como antes de que existiera el horario. */
  activo: boolean;
  /** 7 días, domingo primero. */
  dias: DiaHorario[];
  /**
   * Cierre manual ("Cerrar por hoy"): hasta este momento (ISO) no se toman
   * pedidos aunque el horario diga abierto. Se guarda aparte del horario
   * semanal (llave `closed_until`) y se junta aquí al leerlo.
   */
  cerradoHasta?: string | null;
}

export const HORARIO_DEFAULT: Horario = {
  activo: false,
  dias: DIAS.map(() => ({ abierto: true, desde: "13:00", hasta: "23:00" })),
};

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function horaValida(hhmm: string): boolean {
  return HORA_RE.test(hhmm);
}

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Lo que venga de la base, llevado a un Horario válido (o el de fábrica). */
export function normalizarHorario(value: unknown): Horario {
  const v = value as Partial<Horario> | null;
  if (!v || !Array.isArray(v.dias) || v.dias.length !== 7) return HORARIO_DEFAULT;
  return {
    activo: v.activo === true,
    dias: v.dias.map((d, i) => {
      const base = HORARIO_DEFAULT.dias[i];
      return {
        abierto: d?.abierto !== false,
        desde: horaValida(String(d?.desde)) ? String(d.desde) : base.desde,
        hasta: horaValida(String(d?.hasta)) ? String(d.hasta) : base.hasta,
      };
    }),
  };
}

/** Día de la semana (0 = domingo) y minuto del día, en hora de Yucatán. */
export function ahoraEnYucatan(now: Date = new Date()): { dia: number; minuto: number; hora: string } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const h = Number(get("hour"));
  const m = Number(get("minute"));
  return {
    dia,
    minuto: h * 60 + m,
    hora: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
  };
}

/** ¿Se atiende en este momento? Contempla turnos que cruzan la medianoche. */
/** ¿Está vigente el "Cerrar por hoy"? */
export function cerradoManual(horario: Horario, now: Date = new Date()): boolean {
  return !!horario.cerradoHasta && now.getTime() < new Date(horario.cerradoHasta).getTime();
}

export function estaAbierto(horario: Horario, now: Date = new Date()): boolean {
  if (cerradoManual(horario, now)) return false;
  if (!horario.activo) return true;
  const { dia, minuto } = ahoraEnYucatan(now);

  const hoy = horario.dias[dia];
  if (hoy.abierto) {
    const desde = minutos(hoy.desde);
    const hasta = minutos(hoy.hasta);
    if (hasta > desde ? minuto >= desde && minuto < hasta : minuto >= desde) return true;
  }

  // El turno de ayer que cerró pasada la medianoche (p. ej. 18:00–01:00).
  const ayer = horario.dias[(dia + 6) % 7];
  if (ayer.abierto && minutos(ayer.hasta) <= minutos(ayer.desde)) {
    return minuto < minutos(ayer.hasta);
  }
  return false;
}

/** "1:00 pm" — como se lee en México. */
export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const sufijo = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/**
 * Horario para mostrar, agrupando días seguidos iguales:
 * ["Lunes a Viernes: 1:00 pm – 11:00 pm", "Sábado y Domingo: cerrado"].
 * Arranca en lunes, que es como la gente piensa la semana.
 */
export function lineasHorario(horario: Horario): string[] {
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const texto = (d: DiaHorario) =>
    d.abierto ? `${hora12(d.desde)} – ${hora12(d.hasta)}` : "cerrado";

  const grupos: { dias: number[]; texto: string }[] = [];
  for (const i of orden) {
    const t = texto(horario.dias[i]);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.texto === t) ultimo.dias.push(i);
    else grupos.push({ dias: [i], texto: t });
  }

  return grupos.map((g) => {
    const primero = DIAS[g.dias[0]];
    const ultimo = DIAS[g.dias[g.dias.length - 1]];
    const nombre =
      g.dias.length === 1 ? primero : g.dias.length === 2 ? `${primero} y ${ultimo}` : `${primero} a ${ultimo}`;
    return `${nombre}: ${g.texto}`;
  });
}

/** Mensaje para el cliente cuando está cerrado (bot y web). */
export function mensajeCerrado(horario: Horario): string {
  const aviso = cerradoManual(horario)
    ? "🕐 Por hoy ya *cerramos* y no estamos tomando pedidos."
    : "🕐 En este momento estamos *cerrados* y no podemos tomar pedidos.";
  // Sin horario configurado (solo el cierre manual) no hay horario que mostrar.
  const lista = horario.activo
    ? `\n\n*Nuestro horario* (hora de Yucatán):\n${lineasHorario(horario).map((l) => `• ${l}`).join("\n")}`
    : "";
  return `${aviso}${lista}\n\n¡Te esperamos! 🍔`;
}

/** Yucatán está en UTC-6 todo el año (sin horario de verano desde 2022). */
const OFFSET_MIN = -6 * 60;

/**
 * Hasta cuándo dura "Cerrar por hoy": el inicio del siguiente turno del
 * horario (mañana a las 6:00 pm, por ejemplo). Sin horario configurado, hasta
 * mañana a las 6:00 am.
 */
export function siguienteApertura(horario: Horario, now: Date = new Date()): Date {
  const { dia, minuto } = ahoraEnYucatan(now);
  const inicioDelMinuto = now.getTime() - (now.getTime() % 60_000);
  const en = (minutosDesdeAhora: number) => new Date(inicioDelMinuto + minutosDesdeAhora * 60_000);

  if (horario.activo) {
    for (let d = 0; d <= 7; d++) {
      const dd = horario.dias[(dia + d) % 7];
      if (!dd.abierto) continue;
      const abre = minutos(dd.desde);
      if (d === 0 && abre <= minuto) continue; // el de hoy ya empezó
      return en(d * 1440 + abre - minuto);
    }
  }
  return en(1440 - minuto + 6 * 60);
}

/** "mañana a las 6:00 pm", "el viernes a las 1:00 pm" (hora de Yucatán). */
export function describirMomento(fecha: Date, now: Date = new Date()): string {
  const local = (d: Date) => new Date(d.getTime() + OFFSET_MIN * 60_000);
  const dias = Math.round(
    (Date.UTC(local(fecha).getUTCFullYear(), local(fecha).getUTCMonth(), local(fecha).getUTCDate()) -
      Date.UTC(local(now).getUTCFullYear(), local(now).getUTCMonth(), local(now).getUTCDate())) /
      86_400_000,
  );
  const f = local(fecha);
  const hhmm = `${String(f.getUTCHours()).padStart(2, "0")}:${String(f.getUTCMinutes()).padStart(2, "0")}`;
  const cuando = dias === 0 ? "hoy" : dias === 1 ? "mañana" : `el ${DIAS[f.getUTCDay()].toLowerCase()}`;
  return `${cuando} a las ${hora12(hhmm)}`;
}

/**
 * Si está abierto, a qué hora cierra el turno en curso ("23:00"); si no, null.
 * El turno puede ser el de hoy o el de ayer que pasó de la medianoche.
 */
export function abiertoHasta(horario: Horario, now: Date = new Date()): string | null {
  if (!horario.activo || !estaAbierto(horario, now)) return null;
  const { dia, minuto } = ahoraEnYucatan(now);
  const hoy = horario.dias[dia];
  if (hoy.abierto && minuto >= minutos(hoy.desde)) return hoy.hasta;
  return horario.dias[(dia + 6) % 7].hasta;
}

/** Respuesta a "¿cuál es su horario?" / "¿están abiertos?". */
export function mensajeHorario(horario: Horario, now: Date = new Date()): string {
  const hasta = abiertoHasta(horario, now);
  const estado = hasta
    ? `Ahora mismo estamos *abiertos* ✅ hasta las ${hora12(hasta)}. Escribe *menu* para pedir. 🍔`
    : "Ahora mismo estamos *cerrados*. ¡Te esperamos en nuestro horario! 🍔";
  return (
    `🕐 *Nuestro horario* (hora de Yucatán):\n${lineasHorario(horario).map((l) => `• ${l}`).join("\n")}\n\n` +
    estado
  );
}
