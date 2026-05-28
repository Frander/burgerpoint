-- ============================================================
-- Privilegios a nivel de tabla (necesarios además de las políticas RLS).
-- En Supabase los roles anon/authenticated/service_role necesitan GRANT
-- explícito; las políticas RLS solo filtran filas, no otorgan acceso.
-- Ejecutar en Supabase SQL Editor después de 0001_init.sql.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

-- service_role: acceso total (ignora RLS; lo usan scripts/servidor de confianza).
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Catálogo: lectura pública (el filtrado real lo hacen las políticas RLS).
grant select on table categories, products, modifiers to anon, authenticated;

-- Pedidos: el cliente anónimo puede crear; el staff gestiona.
grant insert on table orders, order_items, order_item_modifiers to anon, authenticated;
grant select, update, delete on table orders, order_items, order_item_modifiers to authenticated;

-- Resto de gestión: solo staff autenticado.
grant select, insert, update, delete on table categories, products, modifiers to authenticated;
grant select, insert, update, delete on table inventory_moves to authenticated;
grant select, update on table profiles to authenticated;

-- Asegurar que las tablas futuras también otorguen privilegios por defecto.
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
