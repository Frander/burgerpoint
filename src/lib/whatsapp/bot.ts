import "server-only";
import { formatMoney } from "@/lib/format";
import { BUSINESS } from "@/lib/business";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertOrder } from "@/lib/order-insert";
// El envío sale del ajuste del negocio: el mismo que cobran la web y el PDV.
import { getDeliveryFee } from "@/lib/settings";
import { checkCoupon, getCustomerSummary, redeemCoupon } from "@/lib/loyalty";
import { notifyNewOrder } from "@/lib/whatsapp/notify";
import {
  getBotProduct,
  listCategories,
  listProducts,
  searchProducts,
} from "@/lib/whatsapp/catalog";
import { handleWithAI, isAiEnabled } from "@/lib/whatsapp/ai";
import {
  clearSession,
  getSession,
  pushHistory,
  saveSession,
  setOptOut,
  type BotSession,
  type CartLine,
  type SessionData,
} from "@/lib/whatsapp/session";
import { ORDER_TYPE_META, orderStatusLabel } from "@/lib/orders";
import type { ModifierGroupWithOptions, OrderStatus, OrderType } from "@/lib/types";

/**
 * Bot de pedidos por WhatsApp: menús numerados, sin IA.
 *
 * Todo se responde con números para que funcione en cualquier teléfono y sin
 * ambigüedad. La fase 5 pondrá un LLM encima de estas mismas piezas, así que
 * aquí la regla es que nada dependa de entender lenguaje natural.
 *
 * Devuelve la lista de mensajes a enviar. No manda nada por su cuenta: así se
 * puede probar entero sin tocar la API de Meta.
 */

const MAX_CANTIDAD = 50;

// ---------- utilidades de texto ----------

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita acentos: "menú" -> "menu"
}

/** Interpreta "2", " 2 ", "2." como 2. Devuelve null si no es un número. */
function parseNumber(text: string): number | null {
  const limpio = text.trim().replace(/[.)]$/, "");
  if (!/^\d+$/.test(limpio)) return null;
  return Number(limpio);
}

/** Interpreta "1,3" o "1 3" como [1, 3] (opciones múltiples). */
function parseNumberList(text: string): number[] | null {
  const partes = text
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (partes.length === 0) return null;

  const nums: number[] = [];
  for (const parte of partes) {
    const n = parseNumber(parte);
    if (n === null) return null;
    if (!nums.includes(n)) nums.push(n);
  }
  return nums;
}

const PIE = "\nEscribe *0* para volver al menú.";

/**
 * Sí/no del cliente cuando viene conversando con la IA: contesta "si, confirmo"
 * o "no, cambia algo", no un número. Se mira palabra por palabra, y una
 * negación en la frase manda sobre cualquier afirmación ("no, si acaso mañana").
 */
const SI = ["si", "s", "claro", "va", "dale", "ok", "okay", "confirmo", "confirmar", "confirmado", "correcto", "adelante", "sale", "simon", "listo", "perfecto"];
const NO = ["no", "espera", "cambiar", "cambia", "todavia", "aun", "mejor", "cancela"];

function palabras(cmd: string): string[] {
  return cmd
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function esAfirmativo(cmd: string): boolean {
  const ps = palabras(cmd);
  if (ps.some((p) => NO.includes(p))) return false;
  return ps.some((p) => SI.includes(p));
}

function esNegativo(cmd: string): boolean {
  return palabras(cmd).some((p) => NO.includes(p));
}

// ---------- carrito ----------

function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

function cartResumen(cart: CartLine[]): string {
  if (cart.length === 0) return "Tu carrito está vacío.";

  const lineas = cart.map((l, i) => {
    const extras =
      l.modifiers.length > 0
        ? `\n   _${l.modifiers.map((m) => m.name).join(", ")}_`
        : "";
    return `${i + 1}. ${l.quantity}x ${l.name} — ${formatMoney(
      l.unitPrice * l.quantity,
    )}${extras}`;
  });

  return `🛒 *Tu pedido*\n${lineas.join("\n")}\n\n*Subtotal: ${formatMoney(
    cartTotal(cart),
  )}*`;
}

const ACCIONES_CARRITO =
  "\n\n*1* Agregar más productos\n*2* Confirmar pedido\n*3* Vaciar carrito";

// ---------- pasos ----------

async function pantallaCategorias(
  data: SessionData,
): Promise<{ mensajes: string[]; sesion: [BotSession["state"], SessionData] }> {
  const categorias = await listCategories();

  if (categorias.length === 0) {
    return {
      mensajes: [
        "Por ahora no hay productos disponibles. Intenta más tarde. 🙏",
      ],
      sesion: ["inicio", data],
    };
  }

  const lista = categorias.map((c, i) => `*${i + 1}.* ${c.name}`).join("\n");
  const carrito = (data.cart?.length ?? 0) > 0 ? "\n\n_Escribe *carrito* para ver tu pedido._" : "";

  return {
    mensajes: [
      `📋 *Menú de ${BUSINESS.name}*\n\nResponde con el número de la categoría:\n\n${lista}${carrito}`,
    ],
    sesion: [
      "categoria",
      { ...data, listIds: categorias.map((c) => c.id), categoryId: undefined },
    ],
  };
}

function pantallaProductos(
  data: SessionData,
  productos: Awaited<ReturnType<typeof listProducts>>,
  titulo: string,
): { mensajes: string[]; sesion: [BotSession["state"], SessionData] } {
  const lista = productos
    .map((p, i) => `*${i + 1}.* ${p.name} — ${formatMoney(p.price)}`)
    .join("\n");

  return {
    mensajes: [`${titulo}\n\n${lista}\n\nResponde con el número del producto.${PIE}`],
    sesion: ["producto", { ...data, listIds: productos.map((p) => p.id) }],
  };
}

function pantallaGrupo(
  grupo: ModifierGroupWithOptions,
  nombreProducto: string,
): string {
  const opciones = grupo.modifiers
    .map(
      (m, i) =>
        `*${i + 1}.* ${m.name}${
          Number(m.extra_price) > 0 ? ` (+${formatMoney(Number(m.extra_price))})` : ""
        }`,
    )
    .join("\n");

  const obligatorio = grupo.min_select >= 1;
  const multiple = grupo.max_select > 1;

  const regla = multiple
    ? `Puedes elegir hasta ${grupo.max_select}, separadas por coma (ej. *1,3*).`
    : "Elige *una* opción.";
  const salida = obligatorio ? "" : "\nEscribe *0* si no quieres ninguna.";

  return `🍔 *${nombreProducto}*\n*${grupo.name}*\n\n${opciones}\n\n_${regla}_${salida}`;
}

/** Siguiente paso tras elegir opciones: otro grupo, o la cantidad. */
async function siguientePaso(
  data: SessionData,
  grupos: ModifierGroupWithOptions[],
): Promise<{ mensajes: string[]; sesion: [BotSession["state"], SessionData] }> {
  const pending = data.pending!;

  if (pending.groupIndex < grupos.length) {
    return {
      mensajes: [pantallaGrupo(grupos[pending.groupIndex], pending.name)],
      sesion: ["opciones", data],
    };
  }

  const extras = pending.modifiers.reduce((s, m) => s + m.extra_price, 0);
  const precio = pending.basePrice + extras;

  return {
    mensajes: [
      `¿Cuántos *${pending.name}* quieres? (${formatMoney(precio)} c/u)\n\nResponde con un número.`,
    ],
    sesion: ["cantidad", data],
  };
}

// ---------- seguimiento ----------

function textoEstado(status: OrderStatus, type: OrderType, code: string): string {
  const etiqueta = orderStatusLabel(status, type);

  switch (status) {
    case "nuevo":
      return `📝 Tu pedido *${code}* está registrado. En cuanto lo confirmemos empezamos a prepararlo.`;
    case "en_cocina":
      return `👨‍🍳 ¡Tu pedido *${code}* ya está en preparación!`;
    case "listo":
      return type === "delivery"
        ? `🛵 Tu pedido *${code}* va en camino.`
        : `✅ Tu pedido *${code}* ya está listo para recoger.`;
    case "entregado":
      return `🙏 Tu pedido *${code}* fue entregado. ¡Gracias por tu compra!`;
    case "cancelado":
      return `❌ Tu pedido *${code}* fue cancelado. Si crees que es un error, escríbenos.`;
    default:
      return `Tu pedido *${code}* está en estado: ${etiqueta}.`;
  }
}

/** Último pedido de ese teléfono, para el comando "estado". */
async function ultimoPedido(phone: string) {
  const supabase = createAdminClient();
  if (!supabase) return null;

  // Los pedidos del bot guardan el teléfono normalizado; los de la web los
  // escribe el cliente a mano, así que se busca también por los últimos 10
  // dígitos (el número local, sin lada de país).
  const local = phone.slice(-10);
  const { data } = await supabase
    .from("orders")
    .select("code, status, type, total, created_at")
    .or(`customer_phone.eq.${phone},customer_phone.ilike.%${local}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as {
    code: string;
    status: OrderStatus;
    type: OrderType;
    total: number;
    created_at: string;
  } | null;
}

// ---------- máquina de estados ----------

export interface BotReply {
  mensajes: string[];
  /** Pedido creado en este turno (para la alerta interna). */
  pedido?: { orderId: string; code: string; total: number; type: OrderType; customerName: string };
}

const AYUDA = `Puedo ayudarte a hacer tu pedido 🍔

*menu* — ver el menú
*carrito* — ver tu pedido
*estado* — cómo va tu último pedido
*puntos* — tus puntos y cupones
*cancelar* — empezar de nuevo
*baja* — no recibir más mensajes`;

const { transferencia } = BUSINESS;

/** Lo que el bot contesta cuando el cliente quiere pagar por transferencia. */
export const TEXTO_TRANSFERENCIA = `💳 *Pago por transferencia*

CLABE: *${transferencia.clabe}*
Beneficiario: ${transferencia.beneficiario}
Institución: ${transferencia.institucion}

Cuando hagas la transferencia, *mándanos la foto o captura del comprobante* por aquí para confirmar tu pago. 🙏`;

/** "¿Puedo pagar con transferencia?", "pásame la clabe", "¿a qué cuenta deposito?"… */
function pideTransferencia(cmd: string): boolean {
  return /transfer|transfier|clabe|deposit|numero de cuenta|cuenta bancaria|cuenta para pagar/.test(cmd);
}

export async function handleIncoming(
  phone: string,
  texto: string,
  perfilNombre?: string | null,
): Promise<BotReply> {
  const sesion = await getSession(phone);
  const data: SessionData = { ...sesion.data };
  const cmd = normalize(texto);

  // ----- comandos globales (funcionan en cualquier paso) -----

  if (["baja", "salir", "stop", "no molestar"].includes(cmd)) {
    await setOptOut(phone, true);
    await clearSession(phone);
    return {
      mensajes: [
        "Listo, no te enviaremos más mensajes. Escribe *hola* cuando quieras volver a pedir. 👋",
      ],
    };
  }

  // Lo está atendiendo una persona desde el panel: el bot no contesta nada.
  // Se vuelve a guardar para que la pausa no caduque a media conversación.
  // Lo que escribe queda en el historial para que la IA no pierda el hilo.
  if (sesion.state === "humano") {
    await saveSession(phone, "humano", pushHistory(data, "user", texto));
    return { mensajes: [] };
  }

  if (["ayuda", "help", "?"].includes(cmd)) {
    return { mensajes: [AYUDA] };
  }

  // No cambia el paso en que va: el cliente sigue armando su pedido después.
  if (pideTransferencia(cmd)) {
    return { mensajes: [TEXTO_TRANSFERENCIA] };
  }

  if (cmd === "estado") {
    const pedido = await ultimoPedido(phone);
    if (!pedido) {
      return {
        mensajes: ["No encuentro pedidos recientes con este número. Escribe *menu* para hacer uno. 🍔"],
      };
    }
    return { mensajes: [textoEstado(pedido.status, pedido.type, pedido.code)] };
  }

  // ----- programa de puntos -----

  if (cmd === "puntos" || cmd === "mis puntos") {
    return { mensajes: [await textoPuntos(phone)] };
  }

  if (cmd === "canjear" || cmd === "cupon" || cmd === "cupón") {
    const res = await redeemCoupon(phone);
    if (!res.ok) {
      return { mensajes: [`${res.error}\n\nEscribe *puntos* para ver cómo vas.`] };
    }
    return {
      mensajes: [
        `🎁 ¡Listo! Tu cupón de *${res.percent}% de descuento* es:\n\n*${res.code}*\n\nÚsalo en tu próximo pedido: escribe *cupon ${res.code}* antes de confirmarlo.`,
      ],
    };
  }

  // "cupon ABC123": lo guarda para el pedido que está armando.
  if (cmd.startsWith("cupon ") || cmd.startsWith("cupón ")) {
    const code = texto.trim().split(/\s+/).slice(1).join("").toUpperCase();
    const check = await checkCoupon(code, cartTotal(data.cart ?? []));
    if (!check.ok) return { mensajes: [check.error ?? "Ese cupón no sirve."] };

    data.couponCode = code;
    await saveSession(phone, sesion.state, data);
    return {
      mensajes: [
        `✅ Cupón *${code}* aplicado: ${check.percent}% menos.\n\n${await resumenFinal(data)}`,
      ],
    };
  }

  if (cmd === "cancelar") {
    await clearSession(phone);
    return {
      mensajes: ["Listo, cancelé lo que llevabas. Escribe *menu* para empezar de nuevo."],
    };
  }

  if (cmd === "carrito") {
    if ((data.cart?.length ?? 0) === 0) {
      const pantalla = await pantallaCategorias(data);
      await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
      return { mensajes: ["Tu carrito está vacío. 🛒", ...pantalla.mensajes] };
    }
    await saveSession(phone, "carrito", data);
    return { mensajes: [cartResumen(data.cart!) + ACCIONES_CARRITO] };
  }

  // "menu" siempre lleva al flujo numerado, aunque la IA esté encendida: es la
  // salida de emergencia cuando el cliente (o el modelo) se atora.
  // En "opciones" el 0 significa "ninguna" (pantallaGrupo), no volver al menú.
  const pideMenu =
    ["menu", "carta", "inicio"].includes(cmd) ||
    (cmd === "0" && sesion.state !== "opciones");
  const esSaludo =
    pideMenu ||
    ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches"].includes(cmd);

  // Con IA encendida, todo lo que no sea un paso numerado en curso lo atiende
  // el modelo. Si falla, sigue de largo al menú numerado de siempre.
  if (isAiEnabled() && !pideMenu && (sesion.state === "inicio" || sesion.state === "ia")) {
    const respuesta = await handleWithAI(texto, data, perfilNombre);
    if (respuesta) {
      await saveSession(phone, respuesta.state, respuesta.data);
      return { mensajes: respuesta.mensajes };
    }
  }

  if (esSaludo || sesion.state === "inicio") {
    const saludo =
      sesion.state === "inicio" && esSaludo === false
        ? []
        : [
            `¡Hola${perfilNombre ? ` ${perfilNombre.split(" ")[0]}` : ""}! 👋 Bienvenido a *${BUSINESS.name}*.`,
          ];
    const pantalla = await pantallaCategorias(data);
    await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
    return { mensajes: [...saludo, ...pantalla.mensajes] };
  }

  // ----- pasos -----

  switch (sesion.state) {
    case "categoria": {
      const n = parseNumber(texto);
      const ids = data.listIds ?? [];

      if (n === null || n < 1 || n > ids.length) {
        // Quizá escribió el nombre de un platillo en vez de un número.
        const encontrados = await searchProducts(texto);
        if (encontrados.length > 0) {
          const pantalla = pantallaProductos(
            data,
            encontrados,
            `🔎 Resultados para "${texto.trim()}"`,
          );
          await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
          return { mensajes: pantalla.mensajes };
        }
        const pantalla = await pantallaCategorias(data);
        await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
        return {
          mensajes: ["No entendí esa opción. 🤔", ...pantalla.mensajes],
        };
      }

      const categoryId = ids[n - 1];
      const productos = await listProducts(categoryId);
      if (productos.length === 0) {
        const pantalla = await pantallaCategorias(data);
        await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
        return {
          mensajes: ["Esa categoría no tiene productos disponibles ahora.", ...pantalla.mensajes],
        };
      }

      const categorias = await listCategories();
      const nombre = categorias.find((c) => c.id === categoryId)?.name ?? "Productos";
      const pantalla = pantallaProductos({ ...data, categoryId }, productos, `🍽️ *${nombre}*`);
      await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
      return { mensajes: pantalla.mensajes };
    }

    case "producto": {
      const n = parseNumber(texto);
      const ids = data.listIds ?? [];

      if (n === null || n < 1 || n > ids.length) {
        return {
          mensajes: [`No entendí. Responde con el número del producto (1 a ${ids.length}).${PIE}`],
        };
      }

      const encontrado = await getBotProduct(ids[n - 1]);
      if (!encontrado) {
        return {
          mensajes: [`Ese producto ya no está disponible. Elige otro número.${PIE}`],
        };
      }

      data.pending = {
        productId: encontrado.product.id,
        name: encontrado.product.name,
        basePrice: encontrado.product.price,
        groupIndex: 0,
        modifiers: [],
      };

      const paso = await siguientePaso(data, encontrado.groups);
      await saveSession(phone, paso.sesion[0], paso.sesion[1]);
      return { mensajes: paso.mensajes };
    }

    case "opciones": {
      const pending = data.pending;
      if (!pending) {
        const pantalla = await pantallaCategorias(data);
        await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
        return { mensajes: pantalla.mensajes };
      }

      const encontrado = await getBotProduct(pending.productId);
      if (!encontrado) {
        delete data.pending;
        const pantalla = await pantallaCategorias(data);
        await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
        return {
          mensajes: ["Ese producto se acaba de agotar. 😔", ...pantalla.mensajes],
        };
      }

      const grupo = encontrado.groups[pending.groupIndex];
      if (!grupo) {
        const paso = await siguientePaso(data, encontrado.groups);
        await saveSession(phone, paso.sesion[0], paso.sesion[1]);
        return { mensajes: paso.mensajes };
      }

      const seleccion = parseNumberList(texto);
      const obligatorio = grupo.min_select >= 1;

      // "0" = ninguna, solo si el grupo es opcional.
      if (seleccion && seleccion.length === 1 && seleccion[0] === 0) {
        if (obligatorio) {
          return {
            mensajes: [`*${grupo.name}* es obligatorio.\n\n${pantallaGrupo(grupo, pending.name)}`],
          };
        }
        pending.groupIndex += 1;
        data.pending = pending;
        const paso = await siguientePaso(data, encontrado.groups);
        await saveSession(phone, paso.sesion[0], paso.sesion[1]);
        return { mensajes: paso.mensajes };
      }

      if (
        !seleccion ||
        seleccion.some((s) => s < 1 || s > grupo.modifiers.length)
      ) {
        return {
          mensajes: [`No entendí esa opción.\n\n${pantallaGrupo(grupo, pending.name)}`],
        };
      }

      if (seleccion.length > grupo.max_select) {
        return {
          mensajes: [
            `Puedes elegir máximo ${grupo.max_select} en *${grupo.name}*.\n\n${pantallaGrupo(grupo, pending.name)}`,
          ],
        };
      }

      if (seleccion.length < grupo.min_select) {
        return {
          mensajes: [
            `Tienes que elegir al menos ${grupo.min_select} en *${grupo.name}*.\n\n${pantallaGrupo(grupo, pending.name)}`,
          ],
        };
      }

      for (const s of seleccion) {
        const opcion = grupo.modifiers[s - 1];
        pending.modifiers.push({
          modifier_id: opcion.id,
          name: opcion.name,
          extra_price: Number(opcion.extra_price),
          group_name: grupo.name,
        });
      }

      pending.groupIndex += 1;
      data.pending = pending;
      const paso = await siguientePaso(data, encontrado.groups);
      await saveSession(phone, paso.sesion[0], paso.sesion[1]);
      return { mensajes: paso.mensajes };
    }

    case "cantidad": {
      const pending = data.pending;
      if (!pending) {
        const pantalla = await pantallaCategorias(data);
        await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
        return { mensajes: pantalla.mensajes };
      }

      const n = parseNumber(texto);
      if (n === null || n < 1 || n > MAX_CANTIDAD) {
        return {
          mensajes: [`Responde con un número del 1 al ${MAX_CANTIDAD}. ¿Cuántos *${pending.name}* quieres?`],
        };
      }

      const extras = pending.modifiers.reduce((s, m) => s + m.extra_price, 0);
      const cart = data.cart ?? [];
      cart.push({
        productId: pending.productId,
        name: pending.name,
        unitPrice: pending.basePrice + extras,
        quantity: n,
        modifiers: pending.modifiers,
      });

      data.cart = cart;
      delete data.pending;
      await saveSession(phone, "carrito", data);

      return {
        mensajes: [
          `✅ Agregado: ${n}x ${pending.name}\n\n${cartResumen(cart)}${ACCIONES_CARRITO}`,
        ],
      };
    }

    case "carrito": {
      const n = parseNumber(texto);

      if (n === 1) {
        const pantalla = await pantallaCategorias(data);
        await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
        return { mensajes: pantalla.mensajes };
      }

      if (n === 3) {
        data.cart = [];
        const pantalla = await pantallaCategorias(data);
        await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
        return { mensajes: ["🗑️ Carrito vacío.", ...pantalla.mensajes] };
      }

      if (n === 2) {
        if ((data.cart?.length ?? 0) === 0) {
          const pantalla = await pantallaCategorias(data);
          await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
          return { mensajes: ["Tu carrito está vacío. 🛒", ...pantalla.mensajes] };
        }
        await saveSession(phone, "tipo", data);
        return {
          mensajes: [
            "¿Cómo quieres tu pedido?\n\n*1* 🥡 Para llevar (paso por él)\n*2* 🛵 A domicilio",
          ],
        };
      }

      return {
        mensajes: [cartResumen(data.cart ?? []) + ACCIONES_CARRITO],
      };
    }

    case "tipo": {
      const n = parseNumber(texto);
      if (n !== 1 && n !== 2) {
        return {
          mensajes: ["Responde *1* para llevar o *2* a domicilio."],
        };
      }

      data.type = n === 1 ? "pickup" : "delivery";
      await saveSession(phone, "nombre", data);
      return { mensajes: ["¿A nombre de quién va el pedido?"] };
    }

    case "nombre": {
      const nombre = texto.trim();
      if (nombre.length < 2 || nombre.length > 60) {
        return { mensajes: ["Escribe tu nombre (mínimo 2 letras)."] };
      }

      data.customerName = nombre;

      if (data.type === "delivery") {
        await saveSession(phone, "direccion", data);
        return {
          mensajes: ["📍 Escribe la dirección de entrega (calle, número y referencias)."],
        };
      }

      await saveSession(phone, "confirmar", data);
      return { mensajes: [await resumenFinal(data)] };
    }

    case "direccion": {
      const direccion = texto.trim();
      if (direccion.length < 8) {
        return {
          mensajes: ["Necesito una dirección más completa (calle, número y una referencia)."],
        };
      }

      data.address = direccion;
      await saveSession(phone, "confirmar", data);
      return { mensajes: [await resumenFinal(data)] };
    }

    case "confirmar": {
      const n = parseNumber(texto);

      // Con la IA el cliente contesta "sí" o "no", no un número. El pedido se
      // crea aquí en los dos casos: el modelo nunca lo hace por su cuenta.
      const afirma = n === 1 || esAfirmativo(cmd);
      const niega = n === 2 || esNegativo(cmd);

      if (niega) {
        await saveSession(phone, "carrito", data);
        return { mensajes: [cartResumen(data.cart ?? []) + ACCIONES_CARRITO] };
      }

      if (!afirma) {
        return { mensajes: [await resumenFinal(data)] };
      }

      return await crearPedido(phone, data);
    }

    default: {
      const pantalla = await pantallaCategorias(data);
      await saveSession(phone, pantalla.sesion[0], pantalla.sesion[1]);
      return { mensajes: pantalla.mensajes };
    }
  }
}

/**
 * Mensaje para el cliente cuando el staff reactiva el bot: le recuerda lo que
 * llevaba y qué contestar. Sin carrito no hay nada que retomar (null).
 */
export async function mensajeAlRetomar(sesion: BotSession): Promise<string | null> {
  const { phone, state, data } = sesion;
  if ((data.cart?.length ?? 0) === 0) return null;

  const intro = "🤖 Seguimos con tu pedido.\n\n";
  if (state === "confirmar") return intro + (await resumenFinal(data));
  if (state === "ia") {
    return `${intro}${cartResumen(data.cart!)}\n\n¿Quieres agregar algo más o lo confirmamos?`;
  }

  // A media pantalla numerada (categoría, opciones…) los números que vio ya no
  // sirven: se le regresa al carrito, que tiene sus propias opciones.
  await saveSession(phone, "carrito", data);
  return intro + cartResumen(data.cart!) + ACCIONES_CARRITO;
}

/** Respuesta al comando *puntos*: cuánto lleva y qué puede hacer con ello. */
async function textoPuntos(phone: string): Promise<string> {
  const resumen = await getCustomerSummary(phone);
  if (!resumen) {
    return "Todavía no tienes puntos. Haz tu primer pedido y empiezas a juntarlos. 🍔";
  }

  const partes = [
    `⭐ Tienes *${resumen.points} ${resumen.points === 1 ? "punto" : "puntos"}*.`,
    "",
    `Ganas 1 punto por cada ${formatMoney(resumen.config.pesosPorPunto)} de comida, cuando tu pedido se entrega y se paga.`,
  ];

  if (resumen.faltan === 0) {
    partes.push(
      "",
      `¡Ya puedes cambiarlos por un *${resumen.config.porcentaje}% de descuento*! Escribe *canjear*.`,
    );
  } else {
    partes.push(
      "",
      `Te faltan *${resumen.faltan}* para un ${resumen.config.porcentaje}% de descuento.`,
    );
  }

  return partes.join("\n");
}

async function resumenFinal(data: SessionData): Promise<string> {
  const cart = data.cart ?? [];
  const envio = data.type === "delivery" ? await getDeliveryFee() : 0;
  const comida = cartTotal(cart);

  // El descuento se recalcula cada vez: si el cupón se usó en otro pedido
  // mientras tanto, aquí deja de aparecer en vez de prometer de menos.
  let descuento = 0;
  if (data.couponCode) {
    const check = await checkCoupon(data.couponCode, comida);
    descuento = check.ok ? (check.discount ?? 0) : 0;
  }
  const total = comida + envio - descuento;

  const partes = [
    cartResumen(cart),
    "",
    `*Entrega:* ${ORDER_TYPE_META[data.type ?? "pickup"].label}`,
    `*Nombre:* ${data.customerName ?? "-"}`,
  ];

  if (data.type === "delivery") {
    partes.push(`*Dirección:* ${data.address ?? "-"}`);
    if (envio > 0) partes.push(`*Envío:* ${formatMoney(envio)}`);
  }
  if (descuento > 0) {
    partes.push(`*Cupón ${data.couponCode}:* -${formatMoney(descuento)}`);
  }

  partes.push("", `*TOTAL: ${formatMoney(total)}*`, "", "*1* ✅ Confirmar pedido\n*2* ✏️ Cambiar algo");

  return partes.join("\n");
}

async function crearPedido(phone: string, data: SessionData): Promise<BotReply> {
  const supabase = createAdminClient();
  const cart = data.cart ?? [];

  if (!supabase || cart.length === 0) {
    return {
      mensajes: ["No pude registrar el pedido. Escribe *menu* para intentar de nuevo. 🙏"],
    };
  }

  // insertOrder recalcula precios y opciones contra la base: lo que se guardó en
  // la sesión es solo para mostrar, nunca para cobrar.
  const res = await insertOrder(supabase, {
    customer_name: data.customerName ?? "Cliente WhatsApp",
    customer_phone: phone,
    type: data.type ?? "pickup",
    address: data.address ?? null,
    notes: null,
    origin: "whatsapp",
    status: "nuevo",
    delivery_fee: data.type === "delivery" ? await getDeliveryFee() : 0,
    coupon_code: data.couponCode ?? null,
    items: cart.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      modifiers: l.modifiers.map((m) => ({
        modifier_id: m.modifier_id,
        name: m.name,
        extra_price: m.extra_price,
        group_name: m.group_name,
      })),
    })),
  });

  if (!res.ok || !res.orderId || !res.code) {
    return {
      mensajes: [
        `No pude registrar el pedido: ${res.error ?? "error desconocido"}\n\nEscribe *menu* para intentar de nuevo.`,
      ],
    };
  }

  await clearSession(phone);

  const entrega =
    data.type === "delivery"
      ? "Te avisamos cuando salga a entrega. 🛵"
      : "Te avisamos cuando esté listo para recoger. 🥡";

  return {
    mensajes: [
      `🎉 ¡Pedido confirmado!\n\n*Folio:* ${res.code}\n*Total:* ${formatMoney(res.total ?? 0)}\n\n${entrega}\n\nEscribe *estado* cuando quieras saber cómo va.`,
    ],
    pedido: {
      orderId: res.orderId,
      code: res.code,
      total: res.total ?? 0,
      type: data.type ?? "pickup",
      customerName: data.customerName ?? "Cliente WhatsApp",
    },
  };
}

/**
 * Alerta interna del pedido que acaba de crear el bot.
 *
 * `insertOrder` ya la dispara con `after()`, pero ese `after()` corre dentro de
 * otro `after()` (el del webhook) y Next puede descartarlo. Volver a llamarla
 * aquí es seguro: el índice único de `wa_messages` cancela el segundo envío.
 */
export async function alertaPedidoBot(pedido: NonNullable<BotReply["pedido"]>) {
  await notifyNewOrder({
    orderId: pedido.orderId,
    code: pedido.code,
    type: pedido.type,
    customerName: pedido.customerName,
    total: pedido.total,
  });
}
