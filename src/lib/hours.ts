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
export function estaAbierto(horario: Horario, now: Date = new Date()): boolean {
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
  return (
    "🕐 En este momento estamos *cerrados* y no podemos tomar pedidos.\n\n" +
    `*Nuestro horario* (hora de Yucatán):\n${lineasHorario(horario).map((l) => `• ${l}`).join("\n")}\n\n` +
    "¡Te esperamos! 🍔"
  );
}
