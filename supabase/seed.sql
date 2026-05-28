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
