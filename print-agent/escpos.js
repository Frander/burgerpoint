// Encoder ESC/POS mínimo para impresoras térmicas de 80mm (Epson-compatibles).
// Sin dependencias: genera un Buffer listo para mandar en crudo a la impresora.

const ESC = 0x1b;
const GS = 0x1d;

// Mapa de caracteres español → CP850 (codepage 2 en Epson: ESC t 2).
const CP850 = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3,
  Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9,
  ñ: 0xa4, Ñ: 0xa5, ü: 0x81, Ü: 0x9a,
  "¿": 0xa8, "¡": 0xad, "°": 0xf8, "·": 0xfa,
};

function encodeText(text) {
  const bytes = [];
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code < 0x80) bytes.push(code);
    else if (CP850[ch] !== undefined) bytes.push(CP850[ch]);
    else bytes.push(0x3f); // '?'
  }
  return bytes;
}

export class EscPos {
  constructor({ columns = 48 } = {}) {
    this.columns = columns;
    this.bytes = [];
    // Inicializa y selecciona CP850 para acentos.
    this.raw([ESC, 0x40]); // ESC @
    this.raw([ESC, 0x74, 2]); // ESC t 2 → CP850
  }

  raw(arr) {
    this.bytes.push(...arr);
    return this;
  }

  text(str) {
    this.raw(encodeText(str));
    return this;
  }

  line(str = "") {
    this.text(str);
    this.raw([0x0a]);
    return this;
  }

  /** Línea con texto a la izquierda y a la derecha (rellena con espacios). */
  row(left, right) {
    const l = String(left);
    const r = String(right);
    const space = Math.max(1, this.columns - l.length - r.length);
    return this.line(l + " ".repeat(space) + r);
  }

  align(mode) {
    const n = { left: 0, center: 1, right: 2 }[mode] ?? 0;
    return this.raw([ESC, 0x61, n]);
  }

  bold(on) {
    return this.raw([ESC, 0x45, on ? 1 : 0]);
  }

  /** Tamaño: 1 = normal, 2 = doble ancho y alto. */
  size(n) {
    return this.raw([GS, 0x21, n === 2 ? 0x11 : 0x00]);
  }

  dashes() {
    return this.line("-".repeat(this.columns));
  }

  feed(lines = 1) {
    return this.raw([ESC, 0x64, lines]);
  }

  /** Imprime un código QR nativo (GS ( k, modelo 2). */
  qr(data, { module = 6, ec = 48 } = {}) {
    const bytes = encodeText(data);
    const len = bytes.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);
    this.raw([GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0]); // modelo 2
    this.raw([GS, 0x28, 0x6b, 3, 0, 49, 67, module]); // tamaño de módulo
    this.raw([GS, 0x28, 0x6b, 3, 0, 49, 69, ec]); // corrección de errores L
    this.raw([GS, 0x28, 0x6b, pL, pH, 49, 80, 48, ...bytes]); // datos
    this.raw([GS, 0x28, 0x6b, 3, 0, 49, 81, 48]); // imprimir
    return this;
  }

  /** Corte parcial con alimentación previa. */
  cut() {
    this.feed(4);
    return this.raw([GS, 0x56, 0x42, 0x00]);
  }

  buffer() {
    return Buffer.from(this.bytes);
  }
}

/** Envuelve un texto a un ancho fijo, respetando palabras. */
export function wrap(text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (!line.length) line = word;
    else if ((line + " " + word).length <= width) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
