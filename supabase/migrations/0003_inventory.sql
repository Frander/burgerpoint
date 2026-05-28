-- ============================================================
-- Inventario: el stock de products se mantiene a partir de los
-- movimientos en inventory_moves (historial = fuente de verdad).
-- Ejecutar en Supabase SQL Editor después de 0002_grants.sql.
-- ============================================================

-- Al registrar un movimiento, ajusta el stock del producto.
create or replace function public.apply_inventory_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update products
  set stock = stock
    + (case when new.type = 'entrada' then new.quantity else -new.quantity end)
  where id = new.product_id;
  return new;
end;
$$;

create trigger trg_apply_inventory_move
  after insert on inventory_moves
  for each row execute function public.apply_inventory_move();

-- Al vender (insertar una línea de pedido), descuenta stock de los
-- productos que rastrean inventario, generando un movimiento 'salida'.
-- SECURITY DEFINER permite que funcione aun con pedidos anónimos.
create or replace function public.sale_decrement_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null then
    insert into inventory_moves (product_id, type, quantity, reason)
    select new.product_id, 'salida', new.quantity, 'venta'
    from products
    where id = new.product_id and track_stock = true;
  end if;
  return new;
end;
$$;

create trigger trg_sale_decrement_stock
  after insert on order_items
  for each row execute function public.sale_decrement_stock();
