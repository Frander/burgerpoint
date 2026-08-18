import "server-only";
import { formatMoney } from "@/lib/format";
import { BUSINESS } from "@/lib/business";
import {
  getBotProduct,
  listCategories,
  listProducts,
  searchProducts,
} from "@/lib/whatsapp/catalog";
import type { BotState, CartLine, SessionData } from "@/lib/whatsapp/session";
import type { ModifierGroupWithOptions } from "@/lib/types";

/**
 * Fase 5 — capa de IA (DeepSeek) encima de las mismas herramientas del bot.
 *
 * El modelo conversa, pero NO decide nada por su cuenta: cada acción pasa por
 * una herramienta que valida contra la base (que el producto exista, que no
 * esté agotado, que las opciones obligatorias estén elegidas). Y sobre todo:
 * **la IA nunca crea el pedido**. Lo más que puede hacer es pedir la
 * confirmación; el pedido lo crea el código cuando el cliente dice que sí.
 *
 * Si DeepSeek falla o tarda demasiado, el que contesta es el menú numerado de
 * siempre. La IA es una comodidad, nunca el único camino.
 */

const API_URL = "https://api.deepseek.com/chat/completions";
const MAX_VUELTAS = 6;
const TIMEOUT_MS = 25_000;
/** Cuántos turnos de conversación se recuerdan (ida y vuelta). */
const MAX_HISTORIAL = 10;

export function isAiEnabled(): boolean {
  if (process.env.WHATSAPP_AI === "0") return false;
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

function model(): string {
  return process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
}

// ---------- tipos del protocolo (compatible con OpenAI) ----------

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface AiResult {
  mensajes: string[];
  state: BotState;
  data: SessionData;
}

// ---------- herramientas ----------

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "ver_categorias",
      description:
        "Lista las categorías del menú. Úsala cuando el cliente pregunte qué hay o pida el menú.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ver_productos",
      description: "Lista los productos de una categoría, con sus precios.",
      parameters: {
        type: "object",
        properties: { categoria: { type: "string", description: "Nombre de la categoría" } },
        required: ["categoria"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "buscar_producto",
      description:
        "Busca productos por nombre. Úsala cuando el cliente mencione algo concreto ('la de pollo', 'boneless').",
      parameters: {
        type: "object",
        properties: { texto: { type: "string" } },
        required: ["texto"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ver_opciones",
      description:
        "Devuelve los grupos de opciones de un producto (sabores, extras, quitar ingredientes) y cuáles son obligatorios. Úsala ANTES de agregar al carrito si el producto tiene opciones.",
      parameters: {
        type: "object",
        properties: { producto: { type: "string" } },
        required: ["producto"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "agregar_al_carrito",
      description:
        "Agrega un producto al pedido. Las opciones van por nombre exacto. Si falta alguna obligatoria, la herramienta te lo dirá y tendrás que preguntarle al cliente.",
      parameters: {
        type: "object",
        properties: {
          producto: { type: "string" },
          cantidad: { type: "integer", description: "Por defecto 1" },
          opciones: {
            type: "array",
            items: { type: "string" },
            description: "Nombres de las opciones elegidas",
          },
        },
        required: ["producto"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ver_carrito",
      description: "Muestra lo que lleva el cliente y el subtotal.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "modificar_carrito",
      description: "Quita una línea del carrito (por su número) o lo vacía entero.",
      parameters: {
        type: "object",
        properties: {
          accion: { type: "string", enum: ["quitar", "vaciar"] },
          numero: { type: "integer", description: "Número de línea a quitar" },
        },
        required: ["accion"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fijar_datos_entrega",
      description:
        "Guarda cómo quiere el pedido y a nombre de quién. Para domicilio hace falta la dirección.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["pickup", "delivery"] },
          nombre: { type: "string" },
          direccion: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pedir_confirmacion",
      description:
        "Último paso: muestra el resumen del pedido y le pide al cliente que confirme. NO crea el pedido; eso pasa cuando el cliente responde que sí. Solo úsala cuando ya haya productos, tipo de entrega, nombre y (si es domicilio) dirección.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

const SYSTEM = `Eres el mesero virtual de ${BUSINESS.name}, una hamburguesería en Ticul, Yucatán. Atiendes por WhatsApp.

REGLAS:
- Español mexicano, tono amable y breve. Máximo 4 o 5 líneas por mensaje.
- WhatsApp usa *un asterisco* para negritas. Nunca uses markdown de otro tipo.
- NUNCA inventes productos, precios ni promociones: todo sale de las herramientas.
- Si el producto tiene opciones obligatorias, pregúntaselas al cliente antes de agregarlo.
- No prometas tiempos de entrega ni descuentos.
- Antes de cerrar necesitas: productos, si es para llevar o a domicilio, el nombre y (si es domicilio) la dirección. Pregunta solo lo que falte, de a una cosa por mensaje.
- Cuando ya tengas todo, llama a pedir_confirmacion. Tú no creas el pedido: lo confirma el cliente.
- Si el cliente se pone grosero o pide algo fuera del restaurante, redirígelo con amabilidad.
- Si algo se complica, sugiérele escribir *menu* para usar el menú numerado.`;

// ---------- ejecución de herramientas ----------

/**
 * WhatsApp usa *un* asterisco para negritas y _guion bajo_ para cursivas. El
 * modelo se va a markdown de vez en cuando por más que se le pida en el prompt,
 * así que se corrige aquí en vez de confiar en que obedezca.
 */
function paraWhatsapp(texto: string): string {
  // [\s\S] en vez de . con el flag /s: ese flag exige ES2018 y el proyecto
  // compila a ES2017.
  return texto
    .replace(/\*\*\*([\s\S]+?)\*\*\*/g, "*$1*")
    .replace(/\*\*([\s\S]+?)\*\*/g, "*$1*")
    .replace(/__([\s\S]+?)__/g, "_$1_")
    // Encabezados markdown: WhatsApp los deja como "### Texto".
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
}

function resumenCarrito(cart: CartLine[]): string {
  if (cart.length === 0) return "El carrito está vacío.";
  const lineas = cart.map((l, i) => {
    const extras = l.modifiers.length > 0 ? ` (${l.modifiers.map((m) => m.name).join(", ")})` : "";
    return `${i + 1}. ${l.quantity}x ${l.name}${extras} — ${formatMoney(l.unitPrice * l.quantity)}`;
  });
  const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  return `${lineas.join("\n")}\nSubtotal: ${formatMoney(total)}`;
}

/** Empareja el nombre que dijo el modelo con un producto real. */
async function resolverProducto(nombre: string) {
  const encontrados = await searchProducts(nombre);
  if (encontrados.length === 0) return null;

  const limpio = nombre.trim().toLowerCase();
  return (
    encontrados.find((p) => p.name.toLowerCase() === limpio) ??
    encontrados.find((p) => p.name.toLowerCase().startsWith(limpio)) ??
    encontrados[0]
  );
}

function describirGrupos(grupos: ModifierGroupWithOptions[]): string {
  if (grupos.length === 0) return "Este producto no tiene opciones.";
  return grupos
    .map((g) => {
      const obligatorio = g.min_select >= 1 ? "OBLIGATORIO" : "opcional";
      const cuantas = g.max_select > 1 ? `elige hasta ${g.max_select}` : "elige 1";
      const opciones = g.modifiers
        .map(
          (m) =>
            m.name + (Number(m.extra_price) > 0 ? ` (+${formatMoney(Number(m.extra_price))})` : ""),
        )
        .join(", ");
      return `- ${g.name} [${obligatorio}, ${cuantas}]: ${opciones}`;
    })
    .join("\n");
}

/**
 * Aquí es donde la IA deja de mandar: cada herramienta valida contra la base y
 * devuelve un error legible que el modelo tiene que resolver preguntando.
 */
async function ejecutar(
  nombre: string,
  args: Record<string, unknown>,
  data: SessionData,
): Promise<{ salida: string; confirmar?: boolean }> {
  switch (nombre) {
    case "ver_categorias": {
      const cats = await listCategories();
      return { salida: cats.map((c) => c.name).join("\n") || "No hay categorías." };
    }

    case "ver_productos": {
      const cats = await listCategories();
      const buscada = String(args.categoria ?? "").toLowerCase();
      const cat =
        cats.find((c) => c.name.toLowerCase() === buscada) ??
        cats.find((c) => c.name.toLowerCase().includes(buscada));
      if (!cat) {
        return { salida: `No existe esa categoría. Las que hay: ${cats.map((c) => c.name).join(", ")}` };
      }
      const productos = await listProducts(cat.id);
      return {
        salida:
          productos
            .map((p) => `${p.name} — ${formatMoney(p.price)}${p.has_modifiers ? " (tiene opciones)" : ""}`)
            .join("\n") || "Sin productos disponibles.",
      };
    }

    case "buscar_producto": {
      const encontrados = await searchProducts(String(args.texto ?? ""));
      if (encontrados.length === 0) return { salida: "No encontré nada con ese nombre." };
      return {
        salida: encontrados
          .map((p) => `${p.name} — ${formatMoney(p.price)}${p.has_modifiers ? " (tiene opciones)" : ""}`)
          .join("\n"),
      };
    }

    case "ver_opciones": {
      const producto = await resolverProducto(String(args.producto ?? ""));
      if (!producto) return { salida: "No encontré ese producto." };
      const detalle = await getBotProduct(producto.id);
      if (!detalle) return { salida: "Ese producto no está disponible ahora." };
      return {
        salida: `${detalle.product.name} — ${formatMoney(detalle.product.price)}\n${describirGrupos(detalle.groups)}`,
      };
    }

    case "agregar_al_carrito": {
      const producto = await resolverProducto(String(args.producto ?? ""));
      if (!producto) return { salida: "ERROR: no encontré ese producto en el menú." };

      const detalle = await getBotProduct(producto.id);
      if (!detalle) return { salida: "ERROR: ese producto está agotado." };

      const cantidad = Math.min(Math.max(Number(args.cantidad ?? 1) || 1, 1), 50);
      const pedidas = (Array.isArray(args.opciones) ? args.opciones : []).map((o) =>
        String(o).trim().toLowerCase(),
      );

      const elegidas: CartLine["modifiers"] = [];

      for (const grupo of detalle.groups) {
        const delGrupo = grupo.modifiers.filter((m) =>
          pedidas.includes(m.name.trim().toLowerCase()),
        );

        if (delGrupo.length > grupo.max_select) {
          return {
            salida: `ERROR: en "${grupo.name}" solo se pueden elegir ${grupo.max_select}. Pregúntale al cliente cuál prefiere.`,
          };
        }

        if (delGrupo.length < grupo.min_select) {
          const opciones = grupo.modifiers.map((m) => m.name).join(", ");
          return {
            salida: `FALTA: el grupo "${grupo.name}" es obligatorio (elige ${grupo.min_select}). Opciones: ${opciones}. Pregúntale al cliente y vuelve a llamar a agregar_al_carrito con la opción incluida.`,
          };
        }

        for (const m of delGrupo) {
          elegidas.push({
            modifier_id: m.id,
            name: m.name,
            extra_price: Number(m.extra_price),
            group_name: grupo.name,
          });
        }
      }

      const extras = elegidas.reduce((s, m) => s + m.extra_price, 0);
      const cart = data.cart ?? [];
      cart.push({
        productId: detalle.product.id,
        name: detalle.product.name,
        unitPrice: detalle.product.price + extras,
        quantity: cantidad,
        modifiers: elegidas,
      });
      data.cart = cart;

      return { salida: `Agregado: ${cantidad}x ${detalle.product.name}.\n${resumenCarrito(cart)}` };
    }

    case "ver_carrito":
      return { salida: resumenCarrito(data.cart ?? []) };

    case "modificar_carrito": {
      const cart = data.cart ?? [];
      if (args.accion === "vaciar") {
        data.cart = [];
        return { salida: "Carrito vacío." };
      }
      const n = Number(args.numero ?? 0);
      if (!n || n < 1 || n > cart.length) {
        return { salida: `ERROR: no hay línea ${n}. El carrito tiene ${cart.length}.` };
      }
      const [quitada] = cart.splice(n - 1, 1);
      data.cart = cart;
      return { salida: `Quité ${quitada.name}.\n${resumenCarrito(cart)}` };
    }

    case "fijar_datos_entrega": {
      if (args.tipo === "pickup" || args.tipo === "delivery") data.type = args.tipo;
      if (typeof args.nombre === "string" && args.nombre.trim().length >= 2) {
        data.customerName = args.nombre.trim();
      }
      if (typeof args.direccion === "string" && args.direccion.trim().length >= 8) {
        data.address = args.direccion.trim();
      }
      const falta: string[] = [];
      if (!data.type) falta.push("tipo de entrega");
      if (!data.customerName) falta.push("nombre");
      if (data.type === "delivery" && !data.address) falta.push("dirección");
      return {
        salida: falta.length > 0 ? `Guardado. Todavía falta: ${falta.join(", ")}.` : "Datos completos.",
      };
    }

    case "pedir_confirmacion": {
      const cart = data.cart ?? [];
      if (cart.length === 0) return { salida: "ERROR: el carrito está vacío." };
      if (!data.type) return { salida: "FALTA: pregúntale si es para llevar o a domicilio." };
      if (!data.customerName) return { salida: "FALTA: pregúntale a nombre de quién." };
      if (data.type === "delivery" && !data.address) {
        return { salida: "FALTA: pregúntale la dirección de entrega." };
      }
      return { salida: "Listo, muéstrale el resumen y pídele que confirme.", confirmar: true };
    }

    default:
      return { salida: `ERROR: no existe la herramienta ${nombre}.` };
  }
}

// ---------- bucle de conversación ----------

async function llamar(mensajes: ChatMessage[]): Promise<ChatMessage | null> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: control.signal,
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model(),
        messages: mensajes,
        tools: TOOLS,
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.error(`[whatsapp/ia] HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }

    const json = (await res.json()) as { choices?: { message?: ChatMessage }[] };
    return json.choices?.[0]?.message ?? null;
  } catch (err) {
    console.error("[whatsapp/ia]", (err as Error).message);
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Contesta un mensaje con la IA. Devuelve `null` si DeepSeek no responde, para
 * que el bot numerado tome el relevo.
 */
export async function handleWithAI(
  texto: string,
  data: SessionData,
  perfilNombre?: string | null,
): Promise<AiResult | null> {
  const historial = (data.history ?? []).slice(-MAX_HISTORIAL);

  const contexto: string[] = [];
  if (perfilNombre) contexto.push(`El cliente se llama ${perfilNombre} en WhatsApp.`);
  if ((data.cart?.length ?? 0) > 0) {
    contexto.push(`Carrito actual:\n${resumenCarrito(data.cart ?? [])}`);
  }
  if (data.type) contexto.push(`Tipo de entrega ya elegido: ${data.type}.`);
  if (data.customerName) contexto.push(`Nombre ya dado: ${data.customerName}.`);
  if (data.address) contexto.push(`Dirección ya dada: ${data.address}.`);

  const mensajes: ChatMessage[] = [
    { role: "system", content: SYSTEM + (contexto.length > 0 ? `\n\nESTADO:\n${contexto.join("\n")}` : "") },
    ...historial.map((h) => ({ role: h.role, content: h.content }) as ChatMessage),
    { role: "user", content: texto },
  ];

  let confirmar = false;

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const respuesta = await llamar(mensajes);
    if (!respuesta) return null; // que conteste el bot numerado

    mensajes.push(respuesta);

    const llamadas = respuesta.tool_calls ?? [];
    if (llamadas.length === 0) {
      const contenido = paraWhatsapp((respuesta.content ?? "").trim());
      if (!contenido) {
        console.warn("[whatsapp/ia] el modelo contestó vacío");
        return null;
      }

      data.history = [
        ...historial,
        { role: "user" as const, content: texto },
        { role: "assistant" as const, content: contenido },
      ].slice(-MAX_HISTORIAL);

      return {
        mensajes: [contenido],
        // Si pidió confirmación, el turno siguiente lo maneja el flujo
        // determinista: el pedido lo crea el código, no el modelo.
        state: confirmar ? "confirmar" : "ia",
        data,
      };
    }

    for (const llamada of llamadas) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(llamada.function.arguments || "{}");
      } catch {
        // El modelo mandó JSON roto: se le dice y sigue.
      }

      const { salida, confirmar: pide } = await ejecutar(llamada.function.name, args, data);
      if (pide) confirmar = true;

      mensajes.push({ role: "tool", tool_call_id: llamada.id, content: salida });
    }
  }

  // Se acabaron las vueltas sin una respuesta final.
  console.warn(
    `[whatsapp/ia] sin respuesta tras ${MAX_VUELTAS} vueltas de herramientas`,
  );
  return null;
}
