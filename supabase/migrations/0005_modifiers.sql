-- ============================================================
-- Burger Point — Grupos de opciones / modificadores de producto
-- Ejecutar en Supabase: SQL Editor > pegar y Run (después de 0001-0004).
--
-- Un producto puede tener varios GRUPOS de opciones (ej. "Sin", "Sabor
-- bebida", "Agrégale"). Cada grupo define cuántas opciones se pueden elegir
-- (min_select/max_select). Cada opción (modifier) puede sumar precio extra.
--   · obligatorio  = min_select >= 1
--   · elección única = max_select = 1 (radio); múltiple = max_select > 1
-- ============================================================

create table modifier_groups (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  name        text not null,
  min_select  int not null default 0 check (min_select >= 0),
  max_select  int not null default 1 check (max_select >= 1),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index modifier_groups_product_idx on modifier_groups (product_id);

-- La tabla `modifiers` (de 0001) pasa a colgar de un grupo.
alter table modifiers
  add column if not exists group_id uuid references modifier_groups (id) on delete cascade;
alter table modifiers
  add column if not exists sort_order int not null default 0;
create index if not exists modifiers_group_idx on modifiers (group_id);

-- Snapshot del nombre del grupo en el pedido (para mostrarlo en cocina/recibo).
alter table order_item_modifiers
  add column if not exists group_name text;

-- ---------- RLS: lectura pública, escritura solo staff ----------
alter table modifier_groups enable row level security;

create policy "modifier_groups: lectura publica" on modifier_groups
  for select using (true);
create policy "modifier_groups: escritura staff" on modifier_groups
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

-- ---------- GRANTs explícitos (las políticas no bastan en Supabase) ----------
grant select on table modifier_groups to anon, authenticated;
grant select, insert, update, delete on table modifier_groups to authenticated;
grant all privileges on table modifier_groups to service_role;
