-- ============================================================
-- 0018 — Inventario de carnes (porciones)
--
-- El inventario de 0003 cuenta productos terminados. La carne no se vende
-- sola: una hamburguesa lleva 1, 2 o 3 porciones, de res o de cerdo. Aquí se
-- lleva la cuenta en porciones: "entraron 100 tal fecha" y cada venta
-- descuenta lo que lleva el producto.
--
--   meats          los tipos de carne y cuántas porciones quedan
--   product_meats  qué carne y cuántas porciones lleva cada producto
--   meat_moves     el historial (entradas, ventas, mermas) = fuente de verdad
--   meat_moves_daily  el mismo historial sumado por día, para la pantalla
--
-- La carne NO bloquea ventas: si la cuenta llega a 0 se sigue vendiendo (y
-- baja a negativo), porque un conteo atrasado no debe parar la caja.
--
-- Ejecutar con `supabase db push` después de 0017_pedido_atomico.sql.
-- ============================================================

create table if not exists meats (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  stock       int not null default 0,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into meats (name, sort_order)
values ('Res', 1), ('Cerdo', 2)
on conflict (name) do nothing;

-- Un producto lleva un solo tipo de carne. Sin fila = no lleva carne.
create table if not exists product_meats (
  product_id  uuid primary key references products (id) on delete cascade,
  meat_id     uuid not null references meats (id) on delete cascade,
  portions    int not null check (portions between 1 and 10)
);

create table if not exists meat_moves (
  id             uuid primary key default gen_random_uuid(),
  meat_id        uuid not null references meats (id) on delete cascade,
  type           inventory_move_type not null,
  quantity       int not null check (quantity > 0),
  -- 'compra', 'venta', 'merma', 'ajuste'
  reason         text,
  -- Día al que corresponde (hora de Yucatán): la entrada se puede capturar
  -- después de que llegó la carne.
  moved_on       date not null default ((now() at time zone 'America/Merida')::date),
  order_item_id  uuid references order_items (id) on delete set null,
  -- Porciones que quedaron después de este movimiento (lo llena el trigger).
  -- Sirve para "desde la última entrada salieron N" sin sumar el historial.
  stock_after    int,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists meat_moves_meat_idx on meat_moves (meat_id, created_at desc);

-- Al registrar un movimiento, ajusta las porciones que quedan y anota en el
-- propio movimiento cuántas quedaron.
create or replace function public.apply_meat_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update meats
  set stock = stock
    + (case when new.type = 'entrada' then new.quantity else -new.quantity end)
  where id = new.meat_id
  returning stock into new.stock_after;
  return new;
end;
$$;

drop trigger if exists trg_apply_meat_move on meat_moves;
create trigger trg_apply_meat_move
  before insert on meat_moves
  for each row execute function public.apply_meat_move();

-- Al vender (insertar una línea de pedido), descuenta las porciones que lleva
-- el producto. SECURITY DEFINER: funciona con pedidos anónimos de la web.
-- Si algo falla aquí el pedido entra igual: primero vender, luego contar.
create or replace function public.sale_consume_meat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null then
    begin
      insert into meat_moves (meat_id, type, quantity, reason, order_item_id)
      select pm.meat_id, 'salida', pm.portions * new.quantity, 'venta', new.id
      from product_meats pm
      where pm.product_id = new.product_id and new.quantity > 0;
    exception when others then
      raise warning 'carnes: no se pudo descontar (%): %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sale_consume_meat on order_items;
create trigger trg_sale_consume_meat
  after insert on order_items
  for each row execute function public.sale_consume_meat();

-- Historial por día: cada venta es un movimiento, así que en pantalla se
-- muestra sumado ("4 oct · Res · ventas del día −36"). security_invoker para
-- que apliquen las políticas de meat_moves.
create or replace view meat_moves_daily
with (security_invoker = true) as
select meat_id,
       moved_on,
       type,
       coalesce(reason, '') as reason,
       sum(quantity)::int   as quantity
from meat_moves
group by meat_id, moved_on, type, coalesce(reason, '');

-- ---------- RLS: solo staff, como el resto del inventario ----------
alter table meats         enable row level security;
alter table product_meats enable row level security;
alter table meat_moves    enable row level security;

drop policy if exists "carnes: staff" on meats;
create policy "carnes: staff" on meats
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

drop policy if exists "carnes por producto: staff" on product_meats;
create policy "carnes por producto: staff" on product_meats
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

drop policy if exists "movimientos de carne: staff" on meat_moves;
create policy "movimientos de carne: staff" on meat_moves
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

-- ---------- GRANTs (las políticas no bastan en Supabase) ----------
-- 0002 da SELECT por defecto a anon en las tablas nuevas; aquí se le quita.
revoke all on table meats, product_meats, meat_moves, meat_moves_daily from anon;
grant select, insert, update, delete on table meats, product_meats, meat_moves to authenticated;
grant select on table meat_moves_daily to authenticated;
grant all privileges on table meats, product_meats, meat_moves, meat_moves_daily to service_role;
