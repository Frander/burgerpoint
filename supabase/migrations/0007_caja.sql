-- ============================================================
-- 0007 — Cajas y registros financieros.
-- Sesiones de caja (apertura/cierre con arqueo), movimientos
-- manuales (ingresos/gastos) y vínculo de los pagos a la caja.
-- Ejecutar en Supabase SQL Editor después de 0006_pdv.sql.
-- ============================================================

create type cash_movement_type as enum ('ingreso', 'gasto');

create table cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  opened_at       timestamptz not null default now(),
  opened_by       uuid references auth.users (id) on delete set null,
  opening_amount  numeric(10, 2) not null default 0,
  closed_at       timestamptz,
  closed_by       uuid references auth.users (id) on delete set null,
  -- Efectivo contado al cerrar (arqueo) y el esperado según el sistema.
  closing_amount  numeric(10, 2),
  expected_amount numeric(10, 2),
  notes           text
);
create index cash_sessions_open_idx on cash_sessions (closed_at) where closed_at is null;

create table cash_movements (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references cash_sessions (id) on delete cascade,
  type       cash_movement_type not null,
  category   text,
  method     payment_method not null default 'efectivo',
  amount     numeric(10, 2) not null check (amount > 0),
  notes      text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index cash_movements_session_idx on cash_movements (session_id);

-- Cada pago puede quedar ligado a la caja abierta en ese momento.
alter table order_payments
  add column cash_session_id uuid references cash_sessions (id) on delete set null;
create index order_payments_session_idx on order_payments (cash_session_id);

-- ---------- RLS ----------
alter table cash_sessions  enable row level security;
alter table cash_movements enable row level security;

create policy "cajas: staff" on cash_sessions
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);
create policy "movimientos caja: staff" on cash_movements
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

-- ---------- Grants (ver 0002) ----------
grant select, insert, update, delete on table cash_sessions, cash_movements to authenticated;
grant all privileges on table cash_sessions, cash_movements to service_role;
