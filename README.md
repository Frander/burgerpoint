# 🍔 Burger Point — Sistema de pedidos y gestión

Sistema de pedidos y administración para el restaurante **Burger Point** (Ticul, Yucatán),
inspirado en OlaClick. Los pedidos se arman en la web, se registran en la base de datos
(para cocina y reportes) y se envían por WhatsApp.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS 4**
- **Supabase** (Postgres + Auth + Realtime + Storage)
- **Vercel** (hosting)

## Requisitos

- **Node.js 20.9+** (este proyecto usa Node 22 — ver `.nvmrc`). Con nvm: `nvm use`

## Puesta en marcha (local)

```bash
nvm use            # Node 22
npm install
cp .env.example .env.local   # y rellena los valores
npm run dev        # http://localhost:3000
```

Rutas:
- `/` — menú público (storefront)
- `/admin` — panel administrativo (protegido)
- `/admin/login` — acceso del staff

## Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **Settings → API** copia `Project URL` y `anon key` a `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. En **SQL Editor** ejecuta `supabase/migrations/0001_init.sql` (crea tablas, RLS y Realtime).
4. (Opcional) Ejecuta `supabase/seed.sql` para cargar un menú de ejemplo.
5. Crea el primer usuario del staff en **Authentication → Users → Add user**.
   Luego, en **SQL Editor**, ponle rol admin:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
   ```

## Desplegar en Vercel

1. Sube el repo a GitHub.
2. Importa el proyecto en [vercel.com](https://vercel.com).
3. Añade las variables de entorno (las mismas de `.env.local`).
4. Deploy. Vercel detecta Next.js automáticamente.

## Estructura

```
src/
  app/
    (public)/          # storefront: menú y pedido del cliente
    admin/             # panel: login, pedidos, cocina, menú, inventario, reportes
  components/          # componentes reutilizables
  lib/
    supabase/          # clientes browser/server + refresco de sesión
    types.ts           # tipos del dominio
  proxy.ts             # refresco de sesión + protección de /admin (antes middleware)
supabase/
  migrations/0001_init.sql
  seed.sql
```

## Roadmap

- **Fase 0** ✅ Setup (proyecto, Supabase, estructura, esquema)
- **Fase 1** — Menú público + carrito + pedido por WhatsApp
- **Fase 2** — Backoffice: CRUD de menú + gestión de pedidos
- **Fase 3** — Cocina (KDS) en tiempo real
- **Fase 4** — Inventario + reportes
