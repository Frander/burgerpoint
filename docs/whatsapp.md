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

### 1. Correr la migración
`supabase/migrations/0008_whatsapp.sql` en Supabase → SQL Editor. Crea
`wa_contacts` y `wa_messages`, y agrega `'whatsapp'` al enum `order_origin`.

### 2. Dar de alta la app en Meta
En <https://developers.facebook.com>: app con el caso de uso de WhatsApp,
asociada a tu portafolio de negocio. De ahí salen el **Phone number ID** (un id
numérico, no el teléfono) y el **App Secret**. El token temporal dura 24 h: hay
que crear un **usuario de sistema** con los permisos `whatsapp_business_messaging`
y `whatsapp_business_management` y generar un **token permanente**.

Ojo con el número: el que conectes a la Cloud API **deja de servir en la app
normal de WhatsApp**. El número que recibe las alertas debe ser otro, un
WhatsApp normal (el celular del encargado).

### 3. Registrar la plantilla de la alerta
Categoría **Utility**, idioma **es_MX**, nombre `pedido_nuevo_alerta`. Cuerpo:

```
Nuevo pedido {{1}}
Tipo: {{2}}
Cliente: {{3}}
Total: {{4}}
```

Ejemplos para la revisión de Meta: `260729-0001`, `A domicilio`, `Juan Pérez`,
`MXN 199.00`. La aprobación tarda de minutos a un par de días.

### 4. Poner las variables de entorno
En `.env.local` y en Vercel (ver `.env.example`):

```
WHATSAPP_ACCESS_TOKEN=...        # token permanente
WHATSAPP_PHONE_NUMBER_ID=...     # id numérico del emisor
WHATSAPP_ALERT_TO=52999...       # destino de la alerta, sin '+'
SUPABASE_SERVICE_ROLE_KEY=...    # ya la tienes; ahora sí se usa
```

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

## 🔜 Siguientes fases

- **Fase 2 — Estados del pedido al cliente.** Al cambiar el estado, avisar al
  teléfono del pedido. La lógica de ahorro ya está lista (`hasOpenWindow()`):
  dentro de la ventana va como texto libre gratis, fuera como plantilla.
  Falta la plantilla `pedido_estado` y enganchar el cambio de estado.
- **Fase 3 — Webhook de entrada.** `GET` para la verificación de Meta y `POST`
  para recibir, validando la firma `X-Hub-Signature-256` con el App Secret y
  deduplicando por `wamid` (Meta reintenta). Responder 200 al instante y
  procesar con `after()`. Aquí se llena `wa_contacts.last_inbound_at`, que es lo
  que hace gratis a la fase 2.
- **Fase 4 — Bot con menú numerado**, sin LLM, para dejar probadas las
  herramientas de carrito y la creación del pedido contra `priceLines()`.
- **Fase 5 — DeepSeek** encima de esas herramientas, con confirmación explícita
  del cliente antes de crear el pedido.

El orden importa: si el LLM entra antes de que la creación de pedidos esté
probada, se depuran dos sistemas a la vez.
