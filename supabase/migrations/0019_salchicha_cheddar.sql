-- ============================================================
-- 0019 — Inventario por porciones: salchicha y queso cheddar
--
-- 0018 contaba solo carne (res y cerdo) y un producto llevaba un solo tipo.
-- Ahora la misma cuenta lleva también salchicha y queso cheddar, y un producto
-- puede llevar ninguno, uno o varios a la vez (una hamburguesa de res con
-- cheddar y salchicha descuenta de los tres).
--
-- Las tablas conservan el nombre `meats` / `product_meats` / `meat_moves`
-- aunque ya no sean solo carnes: renombrarlas rompería lo que ya está en uso.
--
-- El trigger sale_consume_meat de 0018 no cambia: ya inserta un movimiento por
-- cada fila de product_meats del producto vendido.
--
-- Ejecutar con `supabase db push` después de 0018_carnes.sql.
-- ============================================================

insert into meats (name, sort_order)
values ('Salchicha', 3), ('Queso cheddar', 4)
on conflict (name) do nothing;

-- Antes: una fila por producto. Ahora: una fila por producto e ingrediente.
alter table product_meats drop constraint if exists product_meats_pkey;
alter table product_meats add primary key (product_id, meat_id);
