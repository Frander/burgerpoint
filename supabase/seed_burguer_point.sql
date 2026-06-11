-- ============================================================
-- Burguer Point — Menú real (burguer-point.ola.click)
-- 10 categorías, 2-3 productos c/u, con grupos de opciones.
-- Ejecutar en Supabase: SQL Editor > pegar y Run (requiere 0001-0005).
-- ============================================================

-- Limpieza del menú anterior (los pedidos no se tocan: order_items
-- guarda snapshot del nombre y product_id queda en null).
delete from modifiers;
delete from modifier_groups;
delete from products;
delete from categories;

-- ---------- Categorías ----------
insert into categories (id, name, sort_order, active) values
  ('4f9e2bf0-ab93-11ee-956f-4b6c3eaca55e', 'Lo más vendido 🔥', 1, true),
  ('706dbaf0-5f74-11ef-a057-cf237804438f', 'De Pollo 🐔', 2, true),
  ('25467af0-29b0-11ef-9dd2-f3a3bd2ae01d', 'Dogos Point Res 🌭', 3, true),
  ('d5c87980-8da5-11ef-a0a1-2dc0bd6e4b4a', 'Alitas 🍗', 4, true),
  ('d14582b0-e093-11ee-b52b-57f8d7528bf0', 'Boneless', 5, true),
  ('be402c50-0ceb-11ef-a435-4b608a2b0bcb', 'Pasta 🍜', 6, true),
  ('df8313d0-e376-11ec-a07d-7f206ce0730b', 'Especialidades de la casa', 7, true),
  ('a03b9b29-a4c2-4ba8-938a-a1064ffb06fc', 'Combos', 8, true),
  ('37c469d0-e382-11ec-9f3a-e11d0ca01999', 'Snacks', 9, true),
  ('df946b40-e376-11ec-bdb8-8382c6a8555a', 'Bebidas', 10, true);

-- ---------- Productos ----------
insert into products (id, category_id, name, description, price, image_url, available, sort_order) values
  ('a1c0ac7c-2fe7-4927-852f-dd26592c6911', '4f9e2bf0-ab93-11ee-956f-4b6c3eaca55e', 'Burger Express', 'Burger Express: Jugosa carne de cerdo 100g, queso derretido y frescos ingredientes. ¡El antojo resuelto!', 49, 'https://assets.olaclick.app/companies/products/images/800/5f6bcf18-6482-49be-b501-554cd6fabda0.png', true, 1),
  ('a1b1cc05-b57a-4b8c-8acc-26e015837ff5', '4f9e2bf0-ab93-11ee-956f-4b6c3eaca55e', 'Combo Triple  Esencial', '🍔 300g de carne de cerdo jugosa a la parrilla
🧀 Queso cheddar
🧅 Cebolla fresca
🥗 Lechuga, tomate y pepinillos pa’ cerrar el trato, agua fresca', 129, 'https://assets.olaclick.app/companies/products/images/800/68dd84e2-73f0-48dd-8a3d-d7c77cfc8e05.png', true, 2),
  ('a1b01ca8-3a86-49c1-95a5-204b19078bf5', '4f9e2bf0-ab93-11ee-956f-4b6c3eaca55e', 'Combo Esencial Doble', '🍔 200 g de carne de cerdo jugosa a la parrilla (2 carnes)
🧀 Queso cheddar
🧅 Cebolla fresca
🥗 Lechuga, tomate y pepinillos pa’ cerrar el trato
🍟 Incluye porción chica de papas y agua fresca', 99, 'https://assets.olaclick.app/companies/products/images/800/1239de39-7997-4e1c-8b29-17dff197e9eb.png', true, 3),
  ('a106fbc8-0a43-4769-ace1-8e2ce923b524', '706dbaf0-5f74-11ef-a057-cf237804438f', 'Tempura Burguer', '🔥 TEMPURA BURGER DE POLLO 🔥
Crujiente ligera · Menos grasa · Más sabor 🤤
No es empanizada…
👉 es pollo en tempura, dorado ligero y crujiente, con queso derretido y vegetales frescos.
La burger perfecta si quieres algo más ligero, pero igual de brutal 🔥', 120, 'https://assets.olaclick.app/companies/products/images/800/267e8018-1d27-42da-9a05-4a74f63086b1.jpg', true, 1),
  ('a11d33fb-ee95-4093-bb26-8ced2ac0ac9f', '706dbaf0-5f74-11ef-a057-cf237804438f', 'Chicken Tenders', 'Chicken Tenders están preparados con pechuga de pollo empanizada al momento, logrando una textura crujiente por fuera y jugosa por dentro
✨ Incluye:
✔️ 6 piezas de chicken tenders
✔️ Porción de papas
✔️ Hasta 3 salsas a elección', 110, 'https://assets.olaclick.app/companies/products/images/800/aec2709f-fe2e-49bf-bfde-2436eb4a23c4.jpg', true, 2),
  ('a110b4a7-7f30-406c-896a-a83a55b465af', '25467af0-29b0-11ef-9dd2-f3a3bd2ae01d', 'Clasic Dog', '¡Disfruta nuestro hotdog de res de 20cm con cebolla, tomate, mayonesa, catsup y mostaza! Incluye agua fresca a elección.', 55, 'https://assets.olaclick.app/companies/products/images/800/ee393927-521c-4b84-8753-04acbe092ab4.png', true, 1),
  ('a110b599-5c76-473d-b841-cd6558aa0e2e', '25467af0-29b0-11ef-9dd2-f3a3bd2ae01d', 'Pizza Dog', 'Disfruta de nuestro hot dogs salchicha de res, de 20cm acompaño de peperoni , salsa de pizza , queso, porción de papas a la francesa y agua frescas a elección 
Incluye : cebolla , tomate y aderezos', 99, 'https://assets.olaclick.app/companies/products/images/800/e15cab01-93f7-46bc-859a-6e7df0cc50ea.png', true, 2),
  ('a110b68f-7aba-4162-a9b7-996e37d8c2e1', '25467af0-29b0-11ef-9dd2-f3a3bd2ae01d', 'Chesse Dog', 'Disfruta de nuestro hot dogs salchicha de res, de 20cm acompaño de combinación de 4 quesos  ,porción de papas a la francesa y agua frescas a elección 
Incluye : cebolla , tomate y aderezos', 99, 'https://assets.olaclick.app/companies/products/images/800/f1289dd3-5906-4c52-a81e-9e402172688c.png', true, 3),
  ('a00574ae-173f-49a5-af84-307556be0b89', 'd5c87980-8da5-11ef-a0a1-2dc0bd6e4b4a', 'Alitas Point', 'Disfruta de nuestras alitas Point 
- 12 PZ de alitas
- 4 salsas a escojer 
-incluye poción de papas a la francesa 
Para comedor disfruta de todas nuestras salsas', 159, 'https://assets.olaclick.app/companies/products/images/800/6c7e101e-5a3a-4e20-843b-ea77d0866700.jpg', true, 1),
  ('d63845e0-8da5-11ef-965c-53a80dab1394', 'd5c87980-8da5-11ef-a0a1-2dc0bd6e4b4a', 'Point Kids', 'Disfruta de nuestra point Kids , hamburguesa diseñada para los más peques, con carne y queso , incluye mini porción de papas *No incluye vegetales*', 35, 'https://assets.olaclick.app/companies/products/images/800/48726592-185f-40bf-813c-2361eeccf858.png', true, 2),
  ('d1d16bb0-e093-11ee-90ad-472effe7282e', 'd14582b0-e093-11ee-b52b-57f8d7528bf0', 'Boneless', 'Disfruta de nuestros boneless bañado con tu salsa favorita a elección (hasta 3) , acompañada de papas a la francesa o gajo y salsa ranch', 220, 'https://assets.olaclick.app/companies/products/images/800/377c68fc-4559-4fb7-8909-b150b284c1d4.jpg', true, 1),
  ('708f5420-611e-11ef-952b-d780731a2cc8', 'd14582b0-e093-11ee-b52b-57f8d7528bf0', 'Bonefriess', 'Disfruta de nuestro Bonefriess
Que incluye 
- Papas a la francesa 
- Bonelees ( 6pz ) Tamaño Talla M 
- Queso líquido 
- salsa ranch 
- Queso parmesano 
- Salsa catsup
Tamaño Boneless M', 130, 'https://assets.olaclick.app/companies/products/images/800/07a897a8-33ab-460e-8665-fbe9a9dc18b8.png', true, 2),
  ('bf322c00-0ceb-11ef-bcd0-eb23c2872bcc', 'be402c50-0ceb-11ef-a435-4b608a2b0bcb', 'Pasta Alfredo', 'Deliciosa pasta Alfredo 300gramos de sabor 
Incluye 
-brócoli 
-zanahoria 
-Tocino 
-Champiñones 
-Queso parmesano 
-Pan con ajo', 145, 'https://assets.olaclick.app/companies/products/images/800/a9f0ccc8-6d81-4442-bb9f-70f3018bcc2c.png', true, 1),
  ('f3ddbed0-59fd-11ef-a9c0-3d10eda29a87', 'be402c50-0ceb-11ef-a435-4b608a2b0bcb', 'Combo Pasta', 'Disfruta de nuestro combo Pasta 
Que incluye 
2 Pasta Point 300 gramos de pasta Alfredo', 220, 'https://assets.olaclick.app/companies/products/images/800/77a4f224-1f29-40a1-b5ed-b35febf2f681.png', true, 2),
  ('df837a10-e376-11ec-abcd-11f17f84192c', 'df8313d0-e376-11ec-a07d-7f206ce0730b', 'Point Máster', '*300 g de carne premium de res seleccionada, sellada al punto perfecto 🔥 
*Doble Queso cheddar madurado que se funde suavemente 🧀  
*Lechuga fresca y crocante 🥬 
*Tocino ahumado artesanal 🥓
* 2 Aro de cebolla empanizado al instante 🧅  
*Pepinillos encurtidos en casa 🥒 
*Rodajas de tomate jugoso y fresco 🍅  
Acompañada de papas doradas al punto ideal, crujientes y deliciosas 🍟', 165, 'https://assets.olaclick.app/companies/products/images/800/c57b0715-e50c-44ec-94e5-68aa3b388b65.png', true, 1),
  ('ec420e00-7c44-11ee-a7ed-a3dbe7bae810', 'df8313d0-e376-11ec-a07d-7f206ce0730b', 'La 4 Quesos', '*150 g de carne premium de res seleccionada, sellada al punto perfecto 🔥 
*Combinacion de 4 quesos  que se funde suavemente 🧀  
*Lechuga fresca y crocante 🥬 
*Tocino ahumado artesanal 🥓
*Aro de cebolla empanizado al instante 🧅  
*Pepinillos encurtidos en casa 🥒 
*Rodajas de tomate jugoso y fresco 🍅  
Acompañada de papas doradas al punto ideal, crujientes y deliciosas 🍟', 150, 'https://assets.olaclick.app/companies/products/images/800/03f0cf74-7e52-415b-a4a6-1cd7246cb190.png', true, 2),
  ('f5307370-5c36-11ef-8d16-ed759bc7e32e', 'df8313d0-e376-11ec-a07d-7f206ce0730b', 'Pizza Point', '*150 g de carne premium de res seleccionada, sellada al punto perfecto 🔥 
*Salsa pizzera con especies 
*Queso mozzarella 
*Peperonis 
*Queso cheddar madurado que se funde suavemente 🧀  
*Lechuga fresca y crocante 🥬 
*Tocino ahumado artesanal 🥓
*Aro de cebolla empanizado al instante 🧅  
*Pepinillos encurtidos en casa 🥒 
*Rodajas de tomate jugoso y fresco 🍅  
Acompañada de papas doradas al punto ideal, crujientes y deliciosas 🍟', 150, 'https://assets.olaclick.app/companies/products/images/800/c5cb8a5e-3934-46bf-87c9-550bd8a61a84.png', true, 3),
  ('a1ae0dcc-0ac6-4cdb-b9b8-e61eaeab2e2c', 'a03b9b29-a4c2-4ba8-938a-a1064ffb06fc', 'Combo Esencial', '🍔 100 g de carne de cerdo jugosa a la parrilla
🧀 Queso cheddar
🧅 Cebolla fresca
🥗 Lechuga, tomate y pepinillos pa’ cerrar el trato
🍟 Incluye porción chica de papas y agua fresca', 69, 'https://assets.olaclick.app/companies/products/images/800/fc19c1fe-7db5-4a34-92ed-3aec322e9d9d.png', true, 1),
  ('a03b9b29-dd20-47af-bfc2-dbd95e5cb985', 'a03b9b29-a4c2-4ba8-938a-a1064ffb06fc', 'Combo Favorito', 'Hamburguesa con todo
- Porción de papas 
- Agua fresca 
- 2 dedos de queso', 109, 'https://assets.olaclick.app/companies/products/images/800/8ce2bf9d-9061-49d2-8297-05c5a0fec665.jpg', true, 2),
  ('a03b9c66-459c-4d04-942a-5ff9e7bdfef1', 'a03b9b29-a4c2-4ba8-938a-a1064ffb06fc', 'Combo Doble Express', '2 hamburguesas con todo 
- 1 porcion de papas 
- 2 aguas frescas', 159, 'https://assets.olaclick.app/companies/products/images/800/8a6ec726-13ef-42f2-8719-23acc984a2db.png', true, 3),
  ('9ef75b45-7cf9-4c99-9612-e3fe46d9ecad', '37c469d0-e382-11ec-9f3a-e11d0ca01999', 'Pecado Point', 'El gusto prohíbo 
Disfruta de:
- 600gramos de papas 
- Queso líquido
- Tocino 
- Carne de hamburguesa
- 2 Huevos estrellado 
- 6 Boneless 
Y salsa catsup
Mediano para 2 personas 
Grande para 3 personas', 160, 'https://assets.olaclick.app/companies/products/images/800/8b135b3a-c14d-4c2d-842f-c15b740f4a67.png', true, 1),
  ('e24360d0-92d0-11ed-a64c-9fab2d7ee506', '37c469d0-e382-11ec-9f3a-e11d0ca01999', 'Dedos de queso', '10 dedos de queso', 95, 'https://assets.olaclick.app/companies/products/images/800/cecf58d7-1323-42db-ae07-9c120d288aa0.jpg', true, 2),
  ('a36d9310-e382-11ec-85dd-a54703bb728a', '37c469d0-e382-11ec-9f3a-e11d0ca01999', 'Aros de cebolla', 'Orden de 12pz', 80, 'https://assets.olaclick.app/companies/products/images/800/6f598496-6cad-4c99-bf49-98e31579e656.jpg', true, 3),
  ('df94c660-e376-11ec-86ea-ef0cfd55481f', 'df946b40-e376-11ec-bdb8-8382c6a8555a', 'Bebida Comedor', null, 25, 'https://assets.olaclick.app/companies/products/images/800/ad5a60cf-cd42-4762-88a0-98604240e16f.jpeg', true, 1),
  ('d916aad0-4fff-11ed-bbac-9bcd346ce48e', 'df946b40-e376-11ec-bdb8-8382c6a8555a', 'Bebida a domicilio 600ML', 'Bebida a domicilio 600ML', 25, 'https://assets.olaclick.app/companies/products/images/800/c22ce8ea-dacd-4f53-955c-6ac85f1541c3.jpeg', true, 2),
  ('53e7d6c0-408f-11ee-aa48-63ff299d73d4', 'df946b40-e376-11ec-bdb8-8382c6a8555a', 'Fuze te', 'Para llevar', 25, 'https://assets.olaclick.app/companies/products/images/800/c6fbda0b-1d1f-4ac5-b933-1d2ea444d0a7.jpeg', true, 3);

-- ---------- Grupos de opciones y modificadores ----------
-- Burger Express · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a1c0ac7c-2fe7-4927-852f-dd26592c6911', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a1c0ac7c-2fe7-4927-852f-dd26592c6911'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- Burger Express · Agrégale
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a1c0ac7c-2fe7-4927-852f-dd26592c6911', 'Agrégale', 0, 4, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a1c0ac7c-2fe7-4927-852f-dd26592c6911'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Tocino', 15, 1),
  ('Queso extra', 10, 2),
  ('Huevo', 10, 3),
  ('Carne extra', 25, 4)
) as m(name, extra_price, sort_order);

-- Combo Triple  Esencial · Bebida del combo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a1b1cc05-b57a-4b8c-8acc-26e015837ff5', 'Bebida del combo', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a1b1cc05-b57a-4b8c-8acc-26e015837ff5'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Coca-Cola', 0, 1),
  ('Coca-Cola Light', 0, 2),
  ('Sprite', 0, 3),
  ('Fanta', 0, 4),
  ('Agua fresca', 0, 5)
) as m(name, extra_price, sort_order);

-- Combo Triple  Esencial · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a1b1cc05-b57a-4b8c-8acc-26e015837ff5', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a1b1cc05-b57a-4b8c-8acc-26e015837ff5'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- Combo Esencial Doble · Bebida del combo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a1b01ca8-3a86-49c1-95a5-204b19078bf5', 'Bebida del combo', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a1b01ca8-3a86-49c1-95a5-204b19078bf5'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Coca-Cola', 0, 1),
  ('Coca-Cola Light', 0, 2),
  ('Sprite', 0, 3),
  ('Fanta', 0, 4),
  ('Agua fresca', 0, 5)
) as m(name, extra_price, sort_order);

-- Combo Esencial Doble · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a1b01ca8-3a86-49c1-95a5-204b19078bf5', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a1b01ca8-3a86-49c1-95a5-204b19078bf5'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- Tempura Burguer · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a106fbc8-0a43-4769-ace1-8e2ce923b524', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a106fbc8-0a43-4769-ace1-8e2ce923b524'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- Tempura Burguer · Aderezo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a106fbc8-0a43-4769-ace1-8e2ce923b524', 'Aderezo', 0, 2, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a106fbc8-0a43-4769-ace1-8e2ce923b524'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Ranch', 0, 1),
  ('Blue cheese', 0, 2),
  ('Chipotle', 0, 3)
) as m(name, extra_price, sort_order);

-- Chicken Tenders · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a11d33fb-ee95-4093-bb26-8ced2ac0ac9f', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a11d33fb-ee95-4093-bb26-8ced2ac0ac9f'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- Chicken Tenders · Aderezo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a11d33fb-ee95-4093-bb26-8ced2ac0ac9f', 'Aderezo', 0, 2, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a11d33fb-ee95-4093-bb26-8ced2ac0ac9f'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Ranch', 0, 1),
  ('Blue cheese', 0, 2),
  ('Chipotle', 0, 3)
) as m(name, extra_price, sort_order);

-- Clasic Dog · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a110b4a7-7f30-406c-896a-a83a55b465af', 'Sin', 0, 5, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a110b4a7-7f30-406c-896a-a83a55b465af'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin mostaza', 0, 3),
  ('Sin catsup', 0, 4),
  ('Sin mayonesa', 0, 5)
) as m(name, extra_price, sort_order);

-- Clasic Dog · Agrégale
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a110b4a7-7f30-406c-896a-a83a55b465af', 'Agrégale', 0, 3, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a110b4a7-7f30-406c-896a-a83a55b465af'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Tocino', 15, 1),
  ('Queso extra', 10, 2),
  ('Jalapeños', 8, 3)
) as m(name, extra_price, sort_order);

-- Pizza Dog · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a110b599-5c76-473d-b841-cd6558aa0e2e', 'Sin', 0, 5, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a110b599-5c76-473d-b841-cd6558aa0e2e'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin mostaza', 0, 3),
  ('Sin catsup', 0, 4),
  ('Sin mayonesa', 0, 5)
) as m(name, extra_price, sort_order);

-- Pizza Dog · Agrégale
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a110b599-5c76-473d-b841-cd6558aa0e2e', 'Agrégale', 0, 3, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a110b599-5c76-473d-b841-cd6558aa0e2e'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Tocino', 15, 1),
  ('Queso extra', 10, 2),
  ('Jalapeños', 8, 3)
) as m(name, extra_price, sort_order);

-- Chesse Dog · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a110b68f-7aba-4162-a9b7-996e37d8c2e1', 'Sin', 0, 5, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a110b68f-7aba-4162-a9b7-996e37d8c2e1'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin mostaza', 0, 3),
  ('Sin catsup', 0, 4),
  ('Sin mayonesa', 0, 5)
) as m(name, extra_price, sort_order);

-- Chesse Dog · Agrégale
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a110b68f-7aba-4162-a9b7-996e37d8c2e1', 'Agrégale', 0, 3, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a110b68f-7aba-4162-a9b7-996e37d8c2e1'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Tocino', 15, 1),
  ('Queso extra', 10, 2),
  ('Jalapeños', 8, 3)
) as m(name, extra_price, sort_order);

-- Alitas Point · Salsa
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a00574ae-173f-49a5-af84-307556be0b89', 'Salsa', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a00574ae-173f-49a5-af84-307556be0b89'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('BBQ', 0, 1),
  ('Buffalo', 0, 2),
  ('Mango habanero', 0, 3),
  ('Lemon pepper', 0, 4)
) as m(name, extra_price, sort_order);

-- Alitas Point · Aderezo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a00574ae-173f-49a5-af84-307556be0b89', 'Aderezo', 0, 2, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a00574ae-173f-49a5-af84-307556be0b89'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Ranch', 0, 1),
  ('Blue cheese', 0, 2),
  ('Chipotle', 0, 3)
) as m(name, extra_price, sort_order);

-- Point Kids · Salsa
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('d63845e0-8da5-11ef-965c-53a80dab1394', 'Salsa', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'd63845e0-8da5-11ef-965c-53a80dab1394'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('BBQ', 0, 1),
  ('Buffalo', 0, 2),
  ('Mango habanero', 0, 3),
  ('Lemon pepper', 0, 4)
) as m(name, extra_price, sort_order);

-- Point Kids · Aderezo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('d63845e0-8da5-11ef-965c-53a80dab1394', 'Aderezo', 0, 2, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'd63845e0-8da5-11ef-965c-53a80dab1394'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Ranch', 0, 1),
  ('Blue cheese', 0, 2),
  ('Chipotle', 0, 3)
) as m(name, extra_price, sort_order);

-- Boneless · Salsa
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('d1d16bb0-e093-11ee-90ad-472effe7282e', 'Salsa', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'd1d16bb0-e093-11ee-90ad-472effe7282e'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('BBQ', 0, 1),
  ('Buffalo', 0, 2),
  ('Mango habanero', 0, 3),
  ('Lemon pepper', 0, 4)
) as m(name, extra_price, sort_order);

-- Boneless · Aderezo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('d1d16bb0-e093-11ee-90ad-472effe7282e', 'Aderezo', 0, 2, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'd1d16bb0-e093-11ee-90ad-472effe7282e'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Ranch', 0, 1),
  ('Blue cheese', 0, 2),
  ('Chipotle', 0, 3)
) as m(name, extra_price, sort_order);

-- Bonefriess · Salsa
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('708f5420-611e-11ef-952b-d780731a2cc8', 'Salsa', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select '708f5420-611e-11ef-952b-d780731a2cc8'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('BBQ', 0, 1),
  ('Buffalo', 0, 2),
  ('Mango habanero', 0, 3),
  ('Lemon pepper', 0, 4)
) as m(name, extra_price, sort_order);

-- Bonefriess · Aderezo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('708f5420-611e-11ef-952b-d780731a2cc8', 'Aderezo', 0, 2, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select '708f5420-611e-11ef-952b-d780731a2cc8'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Ranch', 0, 1),
  ('Blue cheese', 0, 2),
  ('Chipotle', 0, 3)
) as m(name, extra_price, sort_order);

-- Pasta Alfredo · Agrégale
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('bf322c00-0ceb-11ef-bcd0-eb23c2872bcc', 'Agrégale', 0, 3, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'bf322c00-0ceb-11ef-bcd0-eb23c2872bcc'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Pollo', 25, 1),
  ('Tocino', 15, 2),
  ('Pan con ajo', 20, 3)
) as m(name, extra_price, sort_order);

-- Combo Pasta · Agrégale
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('f3ddbed0-59fd-11ef-a9c0-3d10eda29a87', 'Agrégale', 0, 3, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'f3ddbed0-59fd-11ef-a9c0-3d10eda29a87'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Pollo', 25, 1),
  ('Tocino', 15, 2),
  ('Pan con ajo', 20, 3)
) as m(name, extra_price, sort_order);

-- Point Máster · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('df837a10-e376-11ec-abcd-11f17f84192c', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'df837a10-e376-11ec-abcd-11f17f84192c'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- Point Máster · Agrégale
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('df837a10-e376-11ec-abcd-11f17f84192c', 'Agrégale', 0, 4, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'df837a10-e376-11ec-abcd-11f17f84192c'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Tocino', 15, 1),
  ('Queso extra', 10, 2),
  ('Huevo', 10, 3),
  ('Carne extra', 25, 4)
) as m(name, extra_price, sort_order);

-- La 4 Quesos · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('ec420e00-7c44-11ee-a7ed-a3dbe7bae810', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'ec420e00-7c44-11ee-a7ed-a3dbe7bae810'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- La 4 Quesos · Agrégale
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('ec420e00-7c44-11ee-a7ed-a3dbe7bae810', 'Agrégale', 0, 4, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'ec420e00-7c44-11ee-a7ed-a3dbe7bae810'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Tocino', 15, 1),
  ('Queso extra', 10, 2),
  ('Huevo', 10, 3),
  ('Carne extra', 25, 4)
) as m(name, extra_price, sort_order);

-- Pizza Point · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('f5307370-5c36-11ef-8d16-ed759bc7e32e', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'f5307370-5c36-11ef-8d16-ed759bc7e32e'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- Pizza Point · Agrégale
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('f5307370-5c36-11ef-8d16-ed759bc7e32e', 'Agrégale', 0, 4, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'f5307370-5c36-11ef-8d16-ed759bc7e32e'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Tocino', 15, 1),
  ('Queso extra', 10, 2),
  ('Huevo', 10, 3),
  ('Carne extra', 25, 4)
) as m(name, extra_price, sort_order);

-- Combo Esencial · Bebida del combo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a1ae0dcc-0ac6-4cdb-b9b8-e61eaeab2e2c', 'Bebida del combo', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a1ae0dcc-0ac6-4cdb-b9b8-e61eaeab2e2c'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Coca-Cola', 0, 1),
  ('Coca-Cola Light', 0, 2),
  ('Sprite', 0, 3),
  ('Fanta', 0, 4),
  ('Agua fresca', 0, 5)
) as m(name, extra_price, sort_order);

-- Combo Esencial · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a1ae0dcc-0ac6-4cdb-b9b8-e61eaeab2e2c', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a1ae0dcc-0ac6-4cdb-b9b8-e61eaeab2e2c'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- Combo Favorito · Bebida del combo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a03b9b29-dd20-47af-bfc2-dbd95e5cb985', 'Bebida del combo', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a03b9b29-dd20-47af-bfc2-dbd95e5cb985'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Coca-Cola', 0, 1),
  ('Coca-Cola Light', 0, 2),
  ('Sprite', 0, 3),
  ('Fanta', 0, 4),
  ('Agua fresca', 0, 5)
) as m(name, extra_price, sort_order);

-- Combo Favorito · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a03b9b29-dd20-47af-bfc2-dbd95e5cb985', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a03b9b29-dd20-47af-bfc2-dbd95e5cb985'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- Combo Doble Express · Bebida del combo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a03b9c66-459c-4d04-942a-5ff9e7bdfef1', 'Bebida del combo', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a03b9c66-459c-4d04-942a-5ff9e7bdfef1'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Coca-Cola', 0, 1),
  ('Coca-Cola Light', 0, 2),
  ('Sprite', 0, 3),
  ('Fanta', 0, 4),
  ('Agua fresca', 0, 5)
) as m(name, extra_price, sort_order);

-- Combo Doble Express · Sin
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a03b9c66-459c-4d04-942a-5ff9e7bdfef1', 'Sin', 0, 6, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a03b9c66-459c-4d04-942a-5ff9e7bdfef1'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Sin cebolla', 0, 1),
  ('Sin tomate', 0, 2),
  ('Sin lechuga', 0, 3),
  ('Sin pepinillos', 0, 4),
  ('Sin mayonesa', 0, 5),
  ('Sin catsup', 0, 6)
) as m(name, extra_price, sort_order);

-- Pecado Point · Aderezo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('9ef75b45-7cf9-4c99-9612-e3fe46d9ecad', 'Aderezo', 0, 2, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select '9ef75b45-7cf9-4c99-9612-e3fe46d9ecad'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Catsup', 0, 1),
  ('Ranch', 0, 2),
  ('Chipotle', 0, 3)
) as m(name, extra_price, sort_order);

-- Dedos de queso · Aderezo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('e24360d0-92d0-11ed-a64c-9fab2d7ee506', 'Aderezo', 0, 2, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'e24360d0-92d0-11ed-a64c-9fab2d7ee506'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Catsup', 0, 1),
  ('Ranch', 0, 2),
  ('Chipotle', 0, 3)
) as m(name, extra_price, sort_order);

-- Aros de cebolla · Aderezo
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('a36d9310-e382-11ec-85dd-a54703bb728a', 'Aderezo', 0, 2, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'a36d9310-e382-11ec-85dd-a54703bb728a'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Catsup', 0, 1),
  ('Ranch', 0, 2),
  ('Chipotle', 0, 3)
) as m(name, extra_price, sort_order);

-- Bebida Comedor · Sabor
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('df94c660-e376-11ec-86ea-ef0cfd55481f', 'Sabor', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'df94c660-e376-11ec-86ea-ef0cfd55481f'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Coca-Cola', 0, 1),
  ('Coca-Cola Light', 0, 2),
  ('Sprite', 0, 3),
  ('Fanta', 0, 4)
) as m(name, extra_price, sort_order);

-- Bebida a domicilio 600ML · Sabor
with g as (
  insert into modifier_groups (product_id, name, min_select, max_select, sort_order)
  values ('d916aad0-4fff-11ed-bbac-9bcd346ce48e', 'Sabor', 1, 1, 1)
  returning id
)
insert into modifiers (product_id, group_id, name, extra_price, sort_order)
select 'd916aad0-4fff-11ed-bbac-9bcd346ce48e'::uuid, g.id, m.name, m.extra_price, m.sort_order
from g cross join (values
  ('Coca-Cola', 0, 1),
  ('Coca-Cola Light', 0, 2),
  ('Sprite', 0, 3),
  ('Fanta', 0, 4)
) as m(name, extra_price, sort_order);
