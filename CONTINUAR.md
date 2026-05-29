# 📌 Continuar — Burger Point

Documento para retomar el trabajo en otra sesión. Resume qué está hecho, qué
falta de tu lado, y los próximos pasos sugeridos.

_Última actualización: 29 may 2026 (opciones/modificadores de producto)_

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

Cada fase tiene su commit en git (`git log --oneline`).

### Rutas principales
- `/` — landing/portada (bienvenida + botón "Ver menú y pedir")
- `/menu` — menú público / pedido del cliente
- `/menu/[id]` — detalle de producto con sus opciones (modificadores)
- `/login` — acceso del staff
- `/admin` — panel (pedidos, cocina, menú, inventario, reportes)

---

## ⚠️ PENDIENTE DE TU LADO (importante)

Para que el sistema funcione 100% con tu Supabase, faltan estos pasos manuales:

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

### 1. Deploy a Vercel (recomendado primero) 🚀
Poner el sitio en línea con un dominio real.
- Subir el repo a GitHub.
- Importar en vercel.com, agregar las variables de entorno (las de `.env.local`).
- Configurar dominio.
- Verificar que Realtime y los Server Actions funcionan en producción.

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
      pedidos/               # lista + cambio de estado (actions.ts)
      cocina/                # KDS realtime
      menu/                  # CRUD categorías/productos (actions.ts)
      inventario/            # stock + movimientos (actions.ts)
      reportes/              # ventas y top productos
  components/
    cart/                    # CartProvider, CartDrawer
    storefront/              # Storefront, ProductCard
    admin/                   # CategoryManager, ProductManager, OrderList,
                             # KitchenBoard, InventoryManager
    auth/LoginForm.tsx
  lib/
    supabase/                # client, server, session, auth, config
    types.ts  menu.ts  orders.ts  format.ts  whatsapp.ts  sample-menu.ts
  proxy.ts                   # protege /admin + refresca sesión (ex middleware)
supabase/
  migrations/0001_init.sql  0002_grants.sql  0003_inventory.sql
  seed.sql
```

### Notas técnicas clave
- **Modo preview:** si Supabase no está configurado, el storefront usa
  `sample-menu.ts` y el checkout no persiste. Útil para desarrollo sin DB.
- **Seguridad:** los pedidos los crea el rol `anon` (insert), pero solo el staff
  autenticado puede leerlos/gestionarlos (RLS). Los precios se recalculan
  server-side en `createOrder` (no se confía en el cliente).
- **Supabase necesita GRANTs** además de las políticas RLS (ver `0002_grants.sql`).
