-- ============================================================
-- Burger Point — Esquema inicial
-- Ejecutar en Supabase: SQL Editor > pegar y Run.
-- ============================================================

-- ---------- Tipos ----------
create type order_status as enum (
  'nuevo', 'en_cocina', 'listo', 'entregado', 'cancelado'
);
create type order_type as enum ('delivery', 'pickup');
create type staff_role as enum ('admin', 'cajero', 'cocina');
create type inventory_move_type as enum ('entrada', 'salida');

-- ---------- Perfiles de staff (ligados a auth.users) ----------
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        staff_role not null default 'cajero',
  created_at  timestamptz not null default now()
);

-- Devuelve el rol del usuario actual sin recursión de RLS.
create or replace function public.my_role()
returns staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Crea automáticamente un perfil al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Catálogo ----------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid references categories (id) on delete set null,
  name         text not null,
  description  text,
  price        numeric(10, 2) not null check (price >= 0),
  image_url    text,
  available    boolean not null default true,
  track_stock  boolean not null default false,
  stock        int not null default 0,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index products_category_idx on products (category_id);

create table modifiers (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  name        text not null,
  extra_price numeric(10, 2) not null default 0 check (extra_price >= 0),
  created_at  timestamptz not null default now()
);
create index modifiers_product_idx on modifiers (product_id);

-- ---------- Pedidos ----------
create table orders (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 10000))::text, 4, '0'),
  customer_name   text not null,
  customer_phone  text,
  type            order_type not null default 'delivery',
  address         text,
  status          order_status not null default 'nuevo',
  notes           text,
  total           numeric(10, 2) not null default 0,
  created_at      timestamptz not null default now()
);
create index orders_status_idx on orders (status);
create index orders_created_idx on orders (created_at);

create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders (id) on delete cascade,
  product_id   uuid references products (id) on delete set null,
  product_name text not null,           -- snapshot por si el producto cambia/borra
  quantity     int not null check (quantity > 0),
  unit_price   numeric(10, 2) not null,
  notes        text
);
create index order_items_order_idx on order_items (order_id);

create table order_item_modifiers (
  id            uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items (id) on delete cascade,
  modifier_name text not null,          -- snapshot
  extra_price   numeric(10, 2) not null default 0
);
create index order_item_mods_item_idx on order_item_modifiers (order_item_id);

-- ---------- Inventario ----------
create table inventory_moves (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  type        inventory_move_type not null,
  quantity    int not null check (quantity > 0),
  reason      text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index inventory_moves_product_idx on inventory_moves (product_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles            enable row level security;
alter table categories          enable row level security;
alter table products            enable row level security;
alter table modifiers           enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table order_item_modifiers enable row level security;
alter table inventory_moves     enable row level security;

-- Perfiles: cada quien ve/edita el suyo; admin ve todos.
create policy "perfil propio: leer" on profiles
  for select using (id = auth.uid() or my_role() = 'admin');
create policy "perfil propio: editar" on profiles
  for update using (id = auth.uid() or my_role() = 'admin');

-- Catálogo: lectura pública (storefront); escritura solo staff autenticado.
create policy "catalogo: lectura publica" on categories
  for select using (true);
create policy "catalogo: escritura staff" on categories
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

create policy "productos: lectura publica" on products
  for select using (true);
create policy "productos: escritura staff" on products
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

create policy "modifiers: lectura publica" on modifiers
  for select using (true);
create policy "modifiers: escritura staff" on modifiers
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

-- Pedidos: el cliente (anónimo) puede CREAR; solo staff puede ver/actualizar.
create policy "pedidos: crear publico" on orders
  for insert with check (true);
create policy "pedidos: leer staff" on orders
  for select to authenticated using (my_role() is not null);
create policy "pedidos: actualizar staff" on orders
  for update to authenticated using (my_role() is not null);

create policy "items: crear publico" on order_items
  for insert with check (true);
create policy "items: leer staff" on order_items
  for select to authenticated using (my_role() is not null);

create policy "item_mods: crear publico" on order_item_modifiers
  for insert with check (true);
create policy "item_mods: leer staff" on order_item_modifiers
  for select to authenticated using (my_role() is not null);

-- Inventario: solo staff.
create policy "inventario: staff" on inventory_moves
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

-- ============================================================
-- Realtime: la pantalla de cocina escucha cambios en orders.
-- ============================================================
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
