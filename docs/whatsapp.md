# 📲 WhatsApp — API oficial de Meta (Cloud API)

Guía de la integración de WhatsApp: qué está hecho, qué tienes que dar de alta
tú, y cómo probarlo. Vamos por fases.

**Decisión tomada: conexión directa con Meta, sin BSP.** El acceso a la Cloud
API no tiene costo (solo se pagan los mensajes) y un intermediario como Twilio
cobra ~USD $0.005 por mensaje encima de la tarifa de Meta, que en México ronda
los $0.008 por plantilla de utilidad — casi el doble, a cambio de herramientas
que aquí no hacen falta porque el bot es nuestro.

---

## 💰 Cuánto cuesta cada flujo

Desde el 1 jul 2025 Meta cobra por mensaje, **pero todo lo que mandes dentro de
las 24 h posteriores al último mensaje del cliente es gratis**, incluidas las
plantillas de utilidad. Esa ventana es la que decide el costo:

| Flujo | ¿Ventana abierta? | Costo |
|---|---|---|
| Bot recibiendo pedidos | Sí, el cliente escribió primero | **Gratis** |
| Estados de pedido a quien pidió por WhatsApp | Sí | **Gratis** |
| Estados a quien pidió por la web | No, nunca nos escribió | ~$0.008 USD c/u |
| Alerta interna de pedido nuevo | Nunca (el negocio inicia) | ~$0.008 USD c/u |

La alerta interna es el único costo fijo: a 100 pedidos diarios son ~USD $24 al
mes. Un bot de Telegram haría lo mismo gratis, si algún día quieres cambiarlo.

> Las tarifas cambian seguido. Confírmalas en la página oficial de precios de
> Meta antes de presupuestar.

---

## ✅ Fase 1 — Alerta interna de pedido nuevo (hecha)

Cuando entra un pedido —web, PDV o, más adelante, el bot— sale una plantilla al
número configurado en `WHATSAPP_ALERT_TO`.

Cómo está armado:
- El envío se engancha en `insertOrder()` (`src/lib/order-insert.ts`), que es el
  único punto por donde pasan todos los pedidos. Así ningún origen se queda sin
  alerta ni hay que acordarse de agregarla en cada sitio.
- Sale con `after()` de Next 16: el cliente no espera a la Graph API.
- Va aislada en try/catch. **Un fallo de WhatsApp nunca tumba una venta**; si
  Meta responde mal, el pedido se crea igual y el error queda en el log.
- Si faltan las variables de entorno, todo el módulo es no-op silencioso.
- Idempotencia real: antes de llamar a Meta se inserta la fila en `wa_messages`;
  el índice único `(order_id, dedupe_tag)` hace que un reintento choque y
  cancele el envío, en vez de mandar la alerta dos veces.

Archivos: `src/lib/whatsapp/{config,phone,client,notify}.ts`,
`src/lib/supabase/admin.ts`, `supabase/migrations/0008_whatsapp.sql`.

---

## ⚠️ Lo que tienes que hacer tú

### 1. Correr las migraciones
`0008_whatsapp.sql` (contactos, bitácora y `'whatsapp'` en el enum
`order_origin`) y `0009_wa_bot.sql` (memoria de las conversaciones).
**Ya aplicadas en la base de producción el 13 ago 2026.**

### 2. Dar de alta la app en Meta
En <https://developers.facebook.com>: app con el caso de uso de WhatsApp,
asociada a tu portafolio de negocio. De ahí salen el **Phone number ID** (un id
numérico, no el teléfono) y el **App Secret**. El token temporal dura 24 h: hay
que crear un **usuario de sistema** con los permisos `whatsapp_business_messaging`
y `whatsapp_business_management` y generar un **token permanente**.

Ojo con el número: el que conectes a la Cloud API **deja de servir en la app
normal de WhatsApp**. El número que recibe las alertas debe ser otro, un
WhatsApp normal (el celular del encargado).

### 3. Registrar las plantillas
Ambas categoría **Utility**, idioma **es_MX**. Registradas por API el 14 ago
2026; la aprobación tarda de minutos a un par de días.

`pedido_nuevo_alerta`:

```
Entro un pedido nuevo en Burger Point.

Folio del pedido: {{1}}
Tipo de entrega: {{2}}
Nombre del cliente: {{3}}
Total a cobrar: {{4}}

Entra al panel para mandarlo a cocina.
```

`pedido_estado`:

```
Hola {{1}}, te escribimos de Burger Point para avisarte que tu pedido con
folio {{2}} acaba de cambiar de estado y ahora se encuentra como: {{3}}.
Gracias por tu preferencia.
```

> Meta rechaza las plantillas con muchas variables y poco texto (subcódigo
> 2388293, "la proporción entre parámetros y palabras es superior al límite").
> De ahí que los cuerpos sean largos: acortarlos las hace irregistrables.

### 4. Poner las variables de entorno
En `.env.local` y en Vercel (ver `.env.example`):

```
WHATSAPP_ACCESS_TOKEN=...        # token permanente
WHATSAPP_PHONE_NUMBER_ID=...     # id numérico del emisor
WHATSAPP_ALERT_TO=52999...       # destino de la alerta, sin '+'
WHATSAPP_VERIFY_TOKEN=...        # lo inventas tú; se repite en Meta
WHATSAPP_APP_SECRET=...          # valida la firma del webhook
SUPABASE_SERVICE_ROLE_KEY=...    # ya la tienes; ahora sí se usa
```

### 5. Dar de alta el webhook en Meta
URL `https://<tu-dominio>/api/whatsapp`, el token de verificación del paso
anterior, y **suscribir el campo `messages`** (sin eso no llega nada).

> **`CONFIGURAR-WHATSAPP.txt`** (en la raíz) tiene todo esto en pasos, con los
> comandos de `vercel env add` listos para copiar.

---

## 🧪 Probar

```bash
node --env-file=.env.local scripts/whatsapp-test.mjs            # diagnóstico
node --env-file=.env.local scripts/whatsapp-test.mjs --alerta   # manda la alerta de prueba
```

El diagnóstico verifica el token, muestra el número emisor con su calificación
de calidad y lista las plantillas con su estado de aprobación. Sirve para
separar "mi configuración de Meta está mal" de "mi código está mal" antes de
tocar la app.

---

## ✅ Fase 2 — Estados del pedido al cliente (hecha)

Al cambiar el estado de un pedido se avisa al teléfono que lo hizo. Estados que
avisan: `en_cocina`, `listo`, `entregado`, `cancelado` (`nuevo` no: el cliente
acaba de pedir). En `listo` el texto cambia según el tipo — "va en camino" a
domicilio, "listo para recoger" en pickup.

- Enganchado en `updateOrderStatus()` (panel y cocina) y en
  `finalizeOrder()` / `cancelOrder()` del PDV. Todo con `after()`: el staff no
  espera a la Graph API al mover una tarjeta.
- **Elige el canal más barato que funcione.** Con la ventana de 24 h abierta va
  como texto libre (gratis); cerrada, como plantilla de pago — y solo si
  `WHATSAPP_STATUS_TEMPLATES` está encendido. Apagado por defecto: encenderlo
  es una decisión de dinero, no técnica.
- Respeta `opted_out`: quien pidió la baja no recibe nada, ni gratis.
- Idempotente por `(order_id, 'estado:<status>')`: aunque el staff avance y
  retroceda el estado, cada aviso sale una sola vez.

Archivo: `notifyOrderStatus()` en `src/lib/whatsapp/notify.ts`.

---

## ✅ Fase 3 — Webhook de entrada (hecha)

`src/app/api/whatsapp/route.ts`:

- **GET** — verificación de Meta: compara `hub.verify_token` y devuelve el
  `hub.challenge` en texto plano.
- **POST** — mensajes entrantes. Valida la firma `X-Hub-Signature-256` (HMAC
  SHA-256 del **cuerpo crudo**: parsear y volver a serializar rompería la
  comparación byte a byte), contesta 200 de inmediato y procesa en `after()`,
  porque si Meta no recibe respuesta en pocos segundos reintenta el evento.
- Sin `WHATSAPP_APP_SECRET` el webhook responde 503: la URL es pública y la
  firma es lo único que separa a Meta de cualquiera que la descubra.
- Deduplicación por `wamid` (índice único de `wa_messages`): el reintento de
  Meta no vuelve a contestarle al cliente.
- Cada mensaje entrante actualiza `wa_contacts.last_inbound_at`, que es lo que
  hace gratis a la fase 2.

También registra los acuses (`sent` → `delivered` → `read`) en la bitácora.

---

## ✅ Fase 4 — Bot de pedidos (hecha)

Menús numerados, sin IA. `src/lib/whatsapp/bot.ts` es una máquina de estados y
`wa_sessions` (migración `0009_wa_bot.sql`) es su memoria, porque WhatsApp
manda cada mensaje suelto.

Flujo: categorías → productos → grupos de opciones (respeta `min_select` /
`max_select`, admite `1,3` para múltiples y `0` para ninguna) → cantidad →
carrito → para llevar o domicilio → nombre → dirección → confirmación → pedido.

- El pedido se crea con `insertOrder()`, el mismo camino que la web y el PDV:
  **los precios se recalculan contra la base**, así que lo que quedó guardado
  en la sesión sirve para mostrar, nunca para cobrar.
- Origen `whatsapp`, visible en el historial, los reportes y el ticket.
- Comandos globales en cualquier paso: `menu`, `carrito`, `estado`, `cancelar`,
  `ayuda`, `baja`. Si escriben el nombre de un platillo, lo busca.
- Las conversaciones abandonadas se borran solas a las 6 h
  (`wa_prune_sessions()`, llamada desde el webhook: no hace falta cron).
- La alerta interna se vuelve a disparar desde el bot (`alertaPedidoBot`)
  porque el `after()` de `insertOrder` corre anidado dentro del `after()` del
  webhook y Next puede descartarlo. Es seguro: el índice único cancela el
  duplicado.

### Probarlo sin Meta

Con `WHATSAPP_SIMULATOR=1` en `.env.local` se habilita `/api/whatsapp/simular`,
que devuelve lo que el bot contestaría en vez de mandarlo:

```bash
npm run dev
node scripts/whatsapp-bot-sim.mjs                  # conversación en la terminal
node scripts/whatsapp-bot-sim.mjs "hola|2|1|1,3|0|2"  # guion automático
```

Y para comprobar la firma del webhook como la manda Meta:

```bash
node --env-file=.env.local scripts/whatsapp-webhook-test.mjs "hola"
node --env-file=.env.local scripts/whatsapp-webhook-test.mjs "hola" --mala  # debe dar 401
```

---

## ✅ Fase 5 — IA conversacional (DeepSeek) (hecha)

`src/lib/whatsapp/ai.ts`. El cliente escribe como habla ("quiero 2 BP Match, de
horchata y jamaica, para llevar") y el modelo lo resuelve llamando a las mismas
herramientas del bot numerado.

**El modelo conversa; no decide.** Tres candados, de fuera hacia dentro:

1. **No existe una herramienta para crear pedidos.** Lo más que puede hacer la
   IA es `pedir_confirmacion`, que deja la sesión en el estado `confirmar`. El
   pedido lo crea el código cuando el cliente dice que sí (`esAfirmativo()`
   acepta "sí", "confirmo", "va", "1"…, y cualquier negación en la frase manda
   sobre la afirmación).
2. **Cada herramienta valida contra la base.** `agregar_al_carrito` resuelve el
   nombre contra `products`, rechaza los agotados y exige los grupos
   obligatorios: si falta uno, devuelve `FALTA: …` con las opciones válidas y
   el modelo tiene que preguntarle al cliente. No puede inventar productos,
   precios ni combinaciones imposibles.
3. **Los precios se recalculan igual.** El carrito de la sesión sirve para
   mostrar; `insertOrder()` → `priceLines()` cobra lo que dice la base.
   Verificado: una sesión manipulada a mano con `unitPrice: 1` para 5 BP
   Signature generó un pedido de MXN 1,295, no de MXN 5.

Detalles:

- Modelo por defecto `deepseek-v4-flash` (`DEEPSEEK_MODEL` para cambiarlo).
  Ojo: `deepseek-chat` ya no aparece en `/models`, ahora son los `v4`.
- **Si DeepSeek falla, tarda más de 25 s o se queda sin vueltas, contesta el
  menú numerado.** La IA es una comodidad, nunca el único camino. Sin
  `DEEPSEEK_API_KEY` el bot funciona exactamente como antes.
- `menu` siempre lleva al flujo numerado, aunque la IA esté encendida: es la
  salida cuando el cliente (o el modelo) se atora.
- Las respuestas pasan por `paraWhatsapp()`, que convierte el markdown que a
  veces se le escapa al modelo (`**negritas**`) al formato de WhatsApp (`*`).
- Se recuerdan los últimos 10 turnos en `wa_sessions.data.history`.

---

## 🔜 Siguientes pasos

- Registrar el número real del negocio (hoy corre con el número de prueba de
  Meta, que solo escribe a destinatarios verificados).
- Token permanente en lugar del temporal de 24 h.
