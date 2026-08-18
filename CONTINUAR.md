# 📌 Continuar — Burger Point

Documento para retomar el trabajo en otra sesión. Resume qué está hecho, qué
falta de tu lado, y los próximos pasos sugeridos.

_Última actualización: 17 ago 2026 (WhatsApp completo: alertas, estados,
webhook, bot de pedidos y capa de IA con DeepSeek)_

---

## 🥡 Resumen del proyecto

Sistema de pedidos y gestión para el restaurante **Burger Point** (Ticul,
Yucatán), inspirado en OlaClick. Los pedidos se arman en la web, se registran en
la base de datos (cocina + reportes) y se envían por WhatsApp.

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 ·
Supabase (Postgres + Auth + Realtime + Storage) · Vercel (hosting).

---

## ✅ Lo que YA está hecho (MVP completo)

| Fase | Módulo | Estado |
|------|--------|--------|
| 0 | Setup: Next.js + Supabase + estructura + esquema SQL | ✅ |
| 1 | Storefront público: menú, carrito, pedido por WhatsApp | ✅ |
| 2 | Backoffice: login, CRUD de menú, gestión de pedidos | ✅ |
| 3 | Cocina (KDS) en tiempo real (Supabase Realtime) | ✅ |
| 4 | Inventario (con triggers de stock) + reportes de ventas | ✅ |
| 5 | **PDV** (punto de venta): pedidos En el local / Para llevar / A domicilio / Mesa, pagos, finalizar | ✅ |
| 6 | **Salas y mesas** (CRUD + mapa de mesas en el PDV) | ✅ |
| 7 | **Impresión térmica 80mm**: ticket cliente + comanda (navegador y agente Windows) | ✅ |
| 8 | **Cajas** (apertura/cierre/arqueo), registros financieros, historial con filtros + CSV | ✅ |

Cada fase tiene su commit en git (`git log --oneline`).

### Rutas principales
- `/` — landing/portada (bienvenida + botón "Ver menú y pedir")
- `/menu` — menú público / pedido del cliente
- `/menu/[id]` — detalle de producto con sus opciones (modificadores)
- `/login` — acceso del staff
- `/admin` — panel: **PDV**, pedidos (historial), cocina, menú, **mesas**,
  inventario, **caja**, reportes
- `/print/ticket/[id]?tipo=cliente|cocina` — ticket imprimible 80mm (staff)

### Réplica del panel OlaClick (12 jul 2026)
Se revisó el panel real (panel.olaclick.app, cuenta burguer-point) y se
replicó lo esencial del back:
- **PDV** (`/admin/pdv`): pestañas Mostrador / A domicilio / Mesas (como
  OlaClick), "Nuevo pedido" con atajos Alt+N (local), Alt+R (llevar),
  Alt+Y (domicilio); editor con grid de productos, opciones/modificadores,
  cliente, envío; acciones por pedido: 🖨 ticket, 🖨 comanda, avanzar estado,
  registrar pago (efectivo/tarjeta/transferencia con cambio), finalizar,
  cancelar, + productos. En vivo vía Realtime.
- **Mesas**: salas y mesas (`/admin/mesas`), mapa de mesas libre/ocupada en el
  PDV; agregar productos a una mesa abierta.
- **Pagos**: tabla `order_payments`; el trigger marca el pedido "pagado" al
  cubrir el total. Estado de pago visible en PDV e impreso en el ticket.
- **Caja** (`/admin/caja`): abrir con efectivo inicial, ventas por método del
  turno, ingresos/gastos manuales, cierre con arqueo (esperado vs contado) e
  historial de cajas.
- **Historial de pedidos** (`/admin/pedidos`): filtros por fecha/estado/origen
  (PDV/WEB), total del rango y exportación CSV.
- **Reportes**: además de lo de fase 4, análisis por tipo de servicio
  (en mesa / en local / para llevar / a domicilio) y por origen.
- **Impresión térmica 80mm** (formato de docs/mesa.jpeg y docs/domicilio.jpeg):
  - Manual: botón 🖨 abre `/print/ticket/[id]` y usa el diálogo del navegador
    (funciona con el driver de la impresora).
  - Automática: **agente local** en `print-agent/` (Node, para la PC Windows
    de la caja con la impresora USB compartida). Escucha Realtime e imprime
    comanda + ticket (ESC/POS con QR y corte) cuando el pedido entra a cocina.
    Ver `print-agent/README.md`.

### Orden y edición del menú (29 jul 2026)
Se puede reordenar arrastrando y editar sin borrar/recrear. **No necesita
migración**: `sort_order` ya existía en las tres tablas.
- **Categorías** (`/admin/menu`): asa ⠿ para arrastrar (mouse y táctil) y
  cambiar el orden con que salen en el menú público; el nombre se edita y se
  guarda con Enter, con el botón "Guardar" o al salir del campo.
- **Opciones de cada platillo** (`/admin/menu/[id]`): se arrastran tanto los
  grupos como las opciones dentro de cada grupo; se editan el nombre del grupo
  y el nombre + precio extra de cada opción.
- Componente reutilizable: `src/components/admin/SortableList.tsx` (sin
  dependencias nuevas; también responde a ↑/↓ con el asa enfocada).
- Acciones nuevas en `src/app/admin/menu/actions.ts`: `reorderCategories`,
  `reorderGroups`, `reorderModifiers` y `updateModifier` (esta última faltaba
  por completo: era la razón por la que había que borrar y recrear opciones).
- `revalidateMenu()` ahora también revalida `/menu` (antes solo `/`, que es la
  portada, no el menú).

> Ojo: 46 de los 108 grupos y 94 de las 490 opciones tienen `sort_order = 0`,
> así que dentro de esos productos el orden actual es arbitrario hasta que los
> arrastres una vez; al soltar se renumeran 0..N.

### Productos agotados: se muestran, no se ocultan (29 jul 2026)
Antes, marcar un producto como agotado lo borraba del menú (parecía que ya no
existía) y su página daba 404. Ahora sigue visible, apagado y sin poder pedirse.
- Un producto está agotado si `available = false` **o** si lleva inventario y
  `stock <= 0`. El predicado vive en `src/lib/product.ts` (`isSoldOut`) y
  `getMenu`/`getProduct` lo exponen en el campo transitorio `Product.sold_out`.
- `getMenu()` ya no filtra por `available`, y `getProduct()` tampoco: la ficha
  del producto responde 200 con el aviso en vez de 404.
- Menú (`ProductCard`): texto y foto en gris, "No disponible por ahora" y una
  etiqueta "Agotado" en lugar del botón +.
- Ficha (`ProductDetail`): aviso y el botón de agregar deshabilitado.
- PDV (`PdvOrderEditor`): el producto aparece marcado "Agotado" y no se puede
  tocar, para que la caja tampoco lo venda.
- Red de seguridad en `priceLines` (`src/lib/order-insert.ts`): antes solo
  rechazaba `available = false`; ahora rechaza cualquier agotado, incluido el
  que se quedó sin stock. Los precios se siguen recalculando en el servidor.

---

### WhatsApp con la API oficial de Meta — Fases 1 a 4 (13 ago 2026)
Conexión **directa con Meta, sin BSP**: la Cloud API no cobra por acceso y un
intermediario tipo Twilio casi duplicaría el costo por mensaje.

- **Fase 1 — alerta interna:** llega un WhatsApp al encargado cuando entra
  cualquier pedido (web, PDV o bot).
- **Fase 2 — estados al cliente:** avisos en `en_cocina`, `listo`, `entregado`
  y `cancelado`. Usa texto libre gratis si la ventana de 24 h está abierta; la
  plantilla de pago solo si `WHATSAPP_STATUS_TEMPLATES` lo permite (apagado).
- **Fase 3 — webhook:** `/api/whatsapp` con verificación de Meta, validación de
  firma HMAC sobre el cuerpo crudo y deduplicación por `wamid`.
- **Fase 4 — bot de pedidos:** menús numerados; categorías → productos →
  opciones → cantidad → carrito → entrega → confirmación. Crea el pedido por
  `insertOrder()` (precios recalculados en el servidor) con origen `whatsapp`.
  Comandos: `menu`, `carrito`, `estado`, `cancelar`, `ayuda`, `baja`.
- **Fase 5 — IA conversacional (DeepSeek):** el cliente escribe como habla y el
  modelo usa las mismas herramientas. La IA **no puede crear pedidos** (no hay
  herramienta para eso), cada acción se valida contra la base y los precios se
  recalculan igual. Si DeepSeek falla, contesta el menú numerado.

Migraciones `0008_whatsapp.sql` y `0009_wa_bot.sql` **ya aplicadas** en la base.
Falta **conectar la app de Meta**: pasos y comandos en
**`CONFIGURAR-WHATSAPP.txt`** (raíz). Detalle técnico en `docs/whatsapp.md`.

Se puede probar sin Meta: `WHATSAPP_SIMULATOR=1` y
`node scripts/whatsapp-bot-sim.mjs`.

#### Estado de la conexión con Meta (17 ago 2026)

Hecho:
- App creada en Meta con el caso de uso de WhatsApp (modo **prueba**, número
  `+1 555-009-7417`).
- Variables cargadas en Vercel: `WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_PHONE_NUMBER_ID` (`126308610568986`), `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN` (`bp-webhook-e12fc207f072`), `DEEPSEEK_API_KEY` y
  `DEEPSEEK_MODEL`.
- Plantillas `pedido_nuevo_alerta` y `pedido_estado` registradas por API,
  en revisión de Meta.
- Verificación del webhook probada contra producción: devuelve el challenge.

Falta:
- **El token temporal ya caducó** ("The session is invalid because the user
  logged out"). Los de la pantalla de pruebas duran 24 h: hay que generar uno
  nuevo, o mejor el permanente (paso 3 de `CONFIGURAR-WHATSAPP.txt`), y
  actualizarlo con `vercel env rm WHATSAPP_ACCESS_TOKEN production` + `add`.
- Dar de alta el webhook en Meta con la URL
  `https://burgerpoint-view.vercel.app/api/whatsapp`, el verify token de arriba
  y **suscribir el campo `messages`**.
- Cargar `WHATSAPP_ALERT_TO` (celular del encargado, lada sin `+`): quedó vacío,
  así que la alerta de pedido nuevo no se manda.
- Registrar en Meta los números que pueden recibir mensajes (en modo prueba solo
  escribe a destinatarios verificados): el del encargado y el de pruebas.

#### Agente de impresión (17 ago 2026)
Ya no usa la cuenta admin: corre con el usuario de servicio
`impresora@burgerpoint.local` (rol `cocina`, el mínimo que permite leer
pedidos). `print-agent/config.json` de esta Mac ya apunta ahí. Guía para la PC
de la caja en `print-agent/INSTALAR-EN-WINDOWS.txt` y prueba de impresión con
`print-agent/probar-impresion.bat`.

> Si vuelves a comprimir `print-agent` para llevarlo en USB, recuerda que el zip
> incluye `config.json` con usuario y contraseña: está en `.gitignore` por eso.

---

## ⚠️ PENDIENTE DE TU LADO (importante)

Para que el sistema funcione 100% con tu Supabase, faltan estos pasos manuales:

0. **⚠️ OBLIGATORIO con el código nuevo: correr `0006_pdv.sql` y
   `0007_caja.sql`** en Supabase → SQL Editor (en ese orden, después de la
   0005). La 0006 agrega los tipos de pedido del PDV, pagos, salas/mesas y
   columnas nuevas de `orders` — **sin ella hasta el pedido web falla**, porque
   `createOrder` ya escribe esas columnas. La 0007 crea cajas y registros
   financieros (sin ella, la página Caja te lo indica y el resto funciona).

0a. **WhatsApp:** las migraciones `0008` y `0009` ya están aplicadas. Falta dar
   de alta la app en Meta, registrar las plantillas `pedido_nuevo_alerta` y
   `pedido_estado`, subir las variables `WHATSAPP_*` a Vercel y dar de alta el
   webhook. **Pasos y comandos listos para copiar en `CONFIGURAR-WHATSAPP.txt`.**
   Sin esto no se manda ni se recibe nada por WhatsApp; el resto funciona igual.

0b. **Configurar el agente de impresión** (PC Windows de la caja):
   instalar Node 18+, compartir la impresora térmica 80mm como `POS80`,
   y seguir `print-agent/README.md` (`npm install`, copiar
   `config.example.json` → `config.json` con tus datos, `node index.js`).
   Prueba con `node index.js --test`.

1. **Correr la migración de inventario.** En Supabase → SQL Editor, ejecuta el
   contenido de `supabase/migrations/0003_inventory.sql`.
   _(Las 0001 y 0002 ya las corriste. La 0003 activa los triggers de stock; sin
   ella el inventario registra movimientos pero el stock no se ajusta.)_

2. **Crear tu usuario admin.** En Supabase → Authentication → Users → Add user.
   Luego, en SQL Editor, dale rol admin:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'TU-CORREO');
   ```
   Sin esto, el panel `/admin` te rebota al login.

3. **Correr la migración de Storage (fotos de productos).** En Supabase → SQL
   Editor, ejecuta `supabase/migrations/0004_storage.sql`. Crea el bucket público
   `product-images` y sus políticas (lectura pública, subida solo para staff).
   _Sin esto, subir una foto en admin/menu falla con "bucket not found"._

4. **Correr la migración de opciones/modificadores.** En Supabase → SQL Editor,
   ejecuta `supabase/migrations/0005_modifiers.sql`. Crea la tabla
   `modifier_groups` y extiende `modifiers`. _Sin esto, el menú funciona pero
   los productos no pueden tener grupos de opciones._
   - (Opcional) Vuelve a correr `supabase/seed.sql` para cargar un grupo de
     opciones de ejemplo en la "Hamburguesa Doble".

5. **(Opcional) Configurar WhatsApp.** En `.env.local`, pon el número del
   restaurante en `NEXT_PUBLIC_WHATSAPP_PHONE` (formato internacional sin `+`,
   ej. `5219991234567`). Si lo dejas vacío, el pedido abre WhatsApp sin número
   predefinido.

---

## ▶️ Cómo correr el proyecto localmente

```bash
nvm use        # Node 22 (el sistema trae 18 por defecto; Next 16 necesita 20+)
npm install
npm run dev    # http://localhost:3000
```

> **Nota Node:** SIEMPRE usar Node 22 antes de comandos npm:
> `source ~/.nvm/nvm.sh && nvm use 22`

---

## 🔜 Próximos pasos sugeridos (post-MVP)

Ordenados por impacto/facilidad. Elegir desde aquí en la próxima sesión:

### 1. Deploy a Vercel ✅ HECHO (13 jul 2026)
- **URL de producción: https://burgerpoint-view.vercel.app**
- Proyecto `burgerpoint-view` (el que ya existía, cuenta frander), deploy vía Vercel CLI.
- Variables de entorno cargadas (Supabase, nombre, `NEXT_PUBLIC_SITE_URL`
  para el QR de los tickets).
- Protección SSO de Vercel ajustada a "solo previews" (producción pública).
- Verificado en producción: login, PDV con Realtime "En vivo", menú público
  (78 productos), rutas admin protegidas.
- Siguiente: **dominio propio** (vercel.com → proyecto → Settings → Domains);
  al agregarlo, actualizar `NEXT_PUBLIC_SITE_URL` en Vercel y
  `business.siteUrl` en `print-agent/config.json`, y redeploy.
- Nuevos deploys: `vercel deploy --prod` desde la carpeta del proyecto
  (o conectar el repo a GitHub para deploys automáticos).

### 2. Fotos de productos (Supabase Storage) ✅ HECHO (29 may 2026)
- Bucket público `product-images` vía `0004_storage.sql` (correr en SQL Editor).
- Subida de imagen en alta y edición de producto (`ProductManager` + helper
  `src/lib/upload.ts`); miniatura en la lista del admin.
- `image_url` se muestra en las tarjetas del storefront con `next/image`.
- `next.config.ts` agrega el host de Supabase a `images.remotePatterns`.

### 3. Modificadores / extras en el storefront 🧀 ✅ HECHO (29 may 2026)
- Migración `0005_modifiers.sql`: tabla `modifier_groups` (min/max_select) +
  `modifiers` cuelga de un grupo. Página de detalle `/menu/[id]` con grupos de
  opciones (radio/checkbox, obligatorio, mín/máx), cantidad y comentarios.
- Admin: `/admin/menu/[id]` (botón "Opciones" en cada producto) para crear
  grupos y opciones con precio extra.
- `CartProvider` maneja líneas con modificadores; `createOrder` recalcula
  precios server-side y guarda `order_item_modifiers`.

### 4. Prueba end-to-end del inventario 🧪
Tras correr la 0003: registrar stock → simular una venta → confirmar que el
trigger descuenta. (Puedo hacerlo yo vía REST cuando avises.)

### 5. Mejoras de pedidos
- Notas/modificadores por línea en el carrito (campo ya existe en `order_items`).
- Filtro por estado y búsqueda en `/admin/pedidos`.
- Sonido/notificación al entrar un pedido nuevo en cocina.

### 6. Otros (más adelante)
- App / vista de repartidor.
- Cupones y fidelización (como OlaClick).
- Roles más finos (cajero vs cocina ven distinto).
- Reportes avanzados (rango de fechas, exportar CSV).

---

## 🗂️ Mapa rápido del código

```
src/
  app/
    (public)/layout.tsx      # CartProvider + CartBar (carrito compartido)
    (public)/page.tsx        # landing/portada (botón → /menu)
    (public)/menu/page.tsx   # storefront (server); actions.ts (crear pedido)
    (public)/menu/[id]/      # detalle de producto con opciones (ProductDetail)
    login/page.tsx           # login
    admin/
      layout.tsx             # shell del panel (nav + usuario + logout)
      page.tsx               # dashboard
      pdv/                   # PDV: crear pedidos, pagos, finalizar (actions.ts)
      pedidos/               # historial con filtros + export/route.ts (CSV)
      cocina/                # KDS realtime
      menu/                  # CRUD categorías/productos (actions.ts)
      mesas/                 # CRUD salas y mesas (actions.ts)
      inventario/            # stock + movimientos (actions.ts)
      caja/                  # apertura/cierre, ingresos/gastos (actions.ts)
      reportes/              # ventas, top productos, por tipo de servicio
    print/ticket/[id]/       # ticket 80mm imprimible (cliente/comanda)
  components/
    cart/                    # CartProvider, CartDrawer
    storefront/              # Storefront, ProductCard
    admin/                   # CategoryManager, ProductManager, OrderList,
                             # KitchenBoard, InventoryManager, MesaManager,
                             # CashManager
    admin/pdv/               # PdvBoard, PdvOrderEditor, PdvProductOptions,
                             # PdvPaymentModal
    auth/LoginForm.tsx
  lib/
    supabase/                # client, server, session, auth, config
    types.ts  menu.ts  orders.ts  order-insert.ts  business.ts
    format.ts  whatsapp.ts  sample-menu.ts  upload.ts
  proxy.ts                   # protege /admin + refresca sesión (ex middleware)
supabase/
  migrations/0001_init.sql  0002_grants.sql  0003_inventory.sql
             0004_storage.sql  0005_modifiers.sql  0006_pdv.sql  0007_caja.sql
  seed.sql
print-agent/                 # agente local de impresión (Windows + térmica USB)
  index.js  ticket.js  escpos.js  config.example.json  README.md
```

### Notas técnicas clave
- **Modo preview:** si Supabase no está configurado, el storefront usa
  `sample-menu.ts` y el checkout no persiste. Útil para desarrollo sin DB.
- **Seguridad:** los pedidos los crea el rol `anon` (insert), pero solo el staff
  autenticado puede leerlos/gestionarlos (RLS). Los precios se recalculan
  server-side en `createOrder` (no se confía en el cliente).
- **Supabase necesita GRANTs** además de las políticas RLS (ver `0002_grants.sql`).
