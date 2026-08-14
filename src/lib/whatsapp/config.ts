import "server-only";

/**
 * Configuración de la API oficial de Meta (WhatsApp Cloud API).
 * Todas las variables son de servidor: ninguna lleva NEXT_PUBLIC_, así que
 * nunca llegan al navegador.
 */
export const WHATSAPP = {
  /** Token permanente del usuario de sistema (Meta Business). */
  get token() {
    return process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  },
  /** Id del número emisor (NO el número: el "Phone number ID" de la app). */
  get phoneNumberId() {
    return process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  },
  /** Versión de la Graph API. Subirla cuando Meta deprecie la actual. */
  get graphVersion() {
    return process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
  },
  /** Número que recibe la alerta interna de pedido nuevo (E.164 sin '+'). */
  get alertTo() {
    return process.env.WHATSAPP_ALERT_TO ?? "";
  },
  /** Lada por defecto para teléfonos que el cliente escribe sin ella. */
  get defaultCountryCode() {
    return process.env.WHATSAPP_COUNTRY_CODE || "52";
  },
  /** Idioma con el que se registraron las plantillas en Meta. */
  get templateLang() {
    return process.env.WHATSAPP_TEMPLATE_LANG || "es_MX";
  },
  /** Token que Meta manda en el GET de verificación del webhook. */
  get verifyToken() {
    return process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  },
  /** App Secret, para validar la firma X-Hub-Signature-256 del webhook. */
  get appSecret() {
    return process.env.WHATSAPP_APP_SECRET ?? "";
  },
} as const;

/** Nombres de las plantillas registradas en Meta (configurables por entorno). */
export const WA_TEMPLATES = {
  get nuevoPedidoAlerta() {
    return process.env.WA_TPL_ALERTA || "pedido_nuevo_alerta";
  },
  get estadoPedido() {
    return process.env.WA_TPL_ESTADO || "pedido_estado";
  },
} as const;

/**
 * Si falta configuración, todo el módulo se comporta como no-op: el pedido se
 * crea igual y solo queda un aviso en el log. Nunca debe tumbar una venta.
 */
export function isWhatsappConfigured(): boolean {
  return Boolean(WHATSAPP.token && WHATSAPP.phoneNumberId);
}
