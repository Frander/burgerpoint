-- ============================================================
-- 0013 — Ajustes del negocio
--
-- Una tabla llave/valor para las preferencias que hoy no tienen dónde vivir
-- (la primera: qué repartidor se asigna solo a los domicilios). Se eligió
-- llave/valor en vez de una columna por ajuste para no migrar la base cada vez
-- que aparezca una preferencia nueva; son cuatro filas leídas de vez en cuando,
-- no hay nada que optimizar.
--
-- Ejecutar en Supabase → SQL Editor después de 0012_usuarios.sql.
-- ============================================================

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table app_settings is
  'Preferencias del negocio. Llaves en uso: default_courier_id.';

-- ---------- RLS ----------
-- Todo el staff las lee (el PDV necesita el repartidor por defecto); solo el
-- admin las cambia, como en la pantalla de usuarios.
alter table app_settings enable row level security;

drop policy if exists "ajustes: leer staff" on app_settings;
create policy "ajustes: leer staff" on app_settings
  for select to authenticated using (my_role() is not null);

drop policy if exists "ajustes: escribir admin" on app_settings;
create policy "ajustes: escribir admin" on app_settings
  for all to authenticated
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

-- ---------- GRANTs (las políticas no bastan en Supabase) ----------
grant select, insert, update, delete on table app_settings to authenticated;
grant all privileges on table app_settings to service_role;
