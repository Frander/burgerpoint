-- ============================================================
-- 0015 — Clientes, puntos y cupones
--
-- Cómo funciona, en corto:
--   · El cliente es un TELÉFONO con nombre. No vive en auth.users: el staff y
--     los clientes no se mezclan (ver el hueco que cerró 0014), y así quien
--     pide por el bot ya queda identificado sin registrarse en ningún lado.
--   · Los puntos NO se guardan como un número suelto que alguien pueda editar:
--     son la suma de un libro de movimientos (`point_moves`). Cada pedido puede
--     dar puntos UNA sola vez (índice único por pedido), aunque la acción se
--     reintente o el pedido cambie de estado dos veces.
--   · Un cupón nace gastando puntos y muere al usarse en un pedido.
--
-- Ejecutar en Supabase → SQL Editor después de 0014_registro_publico.sql.
-- ============================================================

-- ---------- Clientes ----------
create table if not exists customers (
  -- E.164 sin '+', igual que wa_contacts: es la llave con la que se cruzan los
  -- pedidos del bot, de la web y del PDV.
  phone        text primary key,
  name         text not null,
  -- Se marca cuando el cliente comprueba el teléfono con un código.
  verified_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- Códigos de verificación ----------
-- El código se guarda HASHEADO: si alguien llega a ver la tabla, no puede
-- entrar con la cuenta de nadie. Se limpian solos al pedir uno nuevo.
create table if not exists customer_otps (
  phone       text primary key,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  sent_at     timestamptz not null default now()
);

-- ---------- Sesiones del cliente ----------
-- Sesión propia (no auth.users): una fila por dispositivo, el token va en una
-- cookie httpOnly. Se guarda hasheado por lo mismo que el código.
create table if not exists customer_sessions (
  token_hash  text primary key,
  phone       text not null references customers (phone) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists customer_sessions_phone_idx on customer_sessions (phone);

-- ---------- Libro de puntos ----------
create table if not exists point_moves (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null references customers (phone) on delete cascade,
  -- Positivo cuando gana, negativo cuando canjea.
  points      int not null,
  reason      text not null check (reason in ('pedido', 'cupon', 'ajuste')),
  order_id    uuid references orders (id) on delete set null,
  coupon_id   uuid,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists point_moves_phone_idx on point_moves (phone, created_at desc);

-- Un pedido acredita puntos una sola vez. Este índice es el que lo garantiza:
-- el segundo intento choca y se ignora.
create unique index if not exists point_moves_order_idx
  on point_moves (order_id)
  where reason = 'pedido' and order_id is not null;

-- ---------- Cupones ----------
create table if not exists coupons (
  id           uuid primary key default gen_random_uuid(),
  -- Corto y legible: la cajera lo teclea o el cliente lo dicta por teléfono.
  code         text not null unique,
  phone        text not null references customers (phone) on delete cascade,
  percent      numeric(5, 2) not null check (percent > 0 and percent <= 100),
  points_cost  int not null check (points_cost >= 0),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  used_at      timestamptz,
  order_id     uuid references orders (id) on delete set null
);
create index if not exists coupons_phone_idx on coupons (phone, created_at desc);

-- ---------- Descuento en el pedido ----------
alter table orders
  add column if not exists discount   numeric(10, 2) not null default 0,
  add column if not exists coupon_id  uuid references coupons (id) on delete set null,
  -- Con qué cliente se acreditan los puntos. Se llena solo desde el teléfono
  -- del pedido; queda aquí para no depender de que el teléfono se edite luego.
  add column if not exists customer_phone_key text;

comment on column orders.discount is
  'Descuento ya aplicado al total (cupón de puntos). Incluido en `total`.';

-- ---------- RLS ----------
-- Nada de esto lo toca el navegador: lo escribe el servidor con la llave de
-- servicio (las acciones del cliente y del panel). El staff puede leer para
-- atender dudas en el mostrador; el repartidor no.
alter table customers         enable row level security;
alter table customer_otps     enable row level security;
alter table customer_sessions enable row level security;
alter table point_moves       enable row level security;
alter table coupons           enable row level security;

create policy "clientes: leer staff" on customers
  for select to authenticated
  using (my_role() is not null and my_role()::text <> 'repartidor');
create policy "puntos: leer staff" on point_moves
  for select to authenticated
  using (my_role() is not null and my_role()::text <> 'repartidor');
create policy "cupones: leer staff" on coupons
  for select to authenticated
  using (my_role() is not null and my_role()::text <> 'repartidor');

-- `customer_otps` y `customer_sessions` se quedan SIN política a propósito:
-- con RLS activo y sin policy, nadie que no sea la llave de servicio las ve.

-- ---------- GRANTs (las políticas no bastan en Supabase) ----------
grant select on table customers, point_moves, coupons to authenticated;
grant all privileges on table
  customers, customer_otps, customer_sessions, point_moves, coupons
  to service_role;
