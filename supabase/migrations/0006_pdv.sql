-- ============================================================
-- 0006 — PDV (punto de venta): tipos de pedido en el local /
-- en mesa, origen del pedido, pagos, salas y mesas.
-- Ejecutar en Supabase SQL Editor después de 0005_modifiers.sql.
-- ============================================================

-- ---------- Nuevos tipos de pedido ----------
-- 'delivery' = a domicilio, 'pickup' = para llevar (ya existían).
alter type order_type add value if not exists 'en_local';
alter type order_type add value if not exists 'en_mesa';

create type order_origin as enum ('web', 'pdv');
create type payment_method as enum ('efectivo', 'tarjeta', 'transferencia');
create type payment_status as enum ('no_pagado', 'pagado');

-- ---------- Salas y mesas ----------
create table salas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table mesas (
  id         uuid primary key default gen_random_uuid(),
  sala_id    uuid not null references salas (id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index mesas_sala_idx on mesas (sala_id);

-- ---------- Pedidos: campos del PDV ----------
alter table orders
  add column origin         order_origin not null default 'web',
  add column payment_status payment_status not null default 'no_pagado',
  add column delivery_fee   numeric(10, 2) not null default 0,
  add column mesa_id        uuid references mesas (id) on delete set null,
  add column served_by      text,
  add column closed_at      timestamptz;

create index orders_mesa_idx on orders (mesa_id);

-- ---------- Pagos ----------
create table order_payments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders (id) on delete cascade,
  method     payment_method not null,
  amount     numeric(10, 2) not null check (amount > 0),
  -- Efectivo recibido (para calcular el cambio); null en tarjeta/transferencia.
  received   numeric(10, 2),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_payments_order_idx on order_payments (order_id);

-- Al registrar un pago, marca el pedido como pagado cuando la suma de pagos
-- cubre el total. SECURITY DEFINER: igual que los triggers de inventario,
-- corre con privilegios del dueño para poder actualizar orders.
create or replace function apply_order_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paid  numeric;
  due   numeric;
begin
  select coalesce(sum(amount), 0) into paid
    from order_payments where order_id = new.order_id;
  select total into due from orders where id = new.order_id;
  if paid >= due then
    update orders set payment_status = 'pagado' where id = new.order_id;
  end if;
  return new;
end;
$$;

create trigger order_payment_applied
  after insert on order_payments
  for each row execute function apply_order_payment();

-- ---------- RLS ----------
alter table salas          enable row level security;
alter table mesas          enable row level security;
alter table order_payments enable row level security;

create policy "salas: staff" on salas
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);
create policy "mesas: staff" on mesas
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);
create policy "pagos: staff" on order_payments
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

-- ---------- Grants (ver 0002: las políticas RLS no otorgan privilegios) ----------
grant select, insert, update, delete on table salas, mesas, order_payments to authenticated;
grant all privileges on table salas, mesas, order_payments to service_role;
