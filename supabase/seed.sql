-- Datos de ejemplo para Burger Point. Ejecutar después de 0001_init.sql.
-- Reemplázalos por el menú real cuando lo tengas.

with cat as (
  insert into categories (name, sort_order) values
    ('Hamburguesas', 1),
    ('Hot Dogs', 2),
    ('Bebidas', 3)
  returning id, name
)
insert into products (category_id, name, description, price, available, sort_order)
select
  cat.id,
  p.name,
  p.description,
  p.price,
  true,
  p.sort_order
from cat
join (values
  ('Hamburguesas', 'Hamburguesa Clásica', 'Carne de res, lechuga, tomate, queso', 75.00, 1),
  ('Hamburguesas', 'Hamburguesa Doble', 'Doble carne, doble queso, tocino',    110.00, 2),
  ('Hot Dogs',     'Hot Dog Sencillo',   'Salchicha, mostaza, catsup',           45.00, 1),
  ('Hot Dogs',     'Hot Dog Especial',   'Salchicha, tocino, queso, jalapeños',  65.00, 2),
  ('Bebidas',      'Refresco 600ml',     'Coca-Cola, Sprite o Fanta',            25.00, 1),
  ('Bebidas',      'Agua embotellada',   '600ml',                                18.00, 2)
) as p(cat_name, name, description, price, sort_order)
  on p.cat_name = cat.name;

-- ---------- Ejemplo de grupos de opciones (requiere 0005_modifiers.sql) ----------
-- Le agrega a la "Hamburguesa Doble": un grupo "Sin" (opcional, múltiple) y
-- un grupo "Agrégale" (opcional, hasta 3, con precios extra).
with prod as (
  select id from products where name = 'Hamburguesa Doble' limit 1
),
g_sin as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  select id, 'Sin', 0, 5, 1 from prod
  returning id, product_id
),
g_extra as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  select id, 'Agrégale', 0, 3, 2 from prod
  returning id, product_id
)
insert into modifiers (group_id, product_id, name, extra_price, sort_order)
select g_sin.id, g_sin.product_id, o.name, 0, o.sort_order
from g_sin
join (values ('Sin cebolla', 1), ('Sin tomate', 2), ('Sin lechuga', 3))
  as o(name, sort_order) on true
union all
select g_extra.id, g_extra.product_id, o.name, o.extra_price, o.sort_order
from g_extra
join (values ('Tocino', 15.00, 1), ('Queso extra', 10.00, 2), ('Huevo', 10.00, 3))
  as o(name, extra_price, sort_order) on true;
