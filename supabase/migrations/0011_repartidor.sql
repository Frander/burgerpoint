-- ============================================================
-- 0011 — Repartidores
--
-- Agrega el rol `repartidor` y la asignación de pedidos a domicilio.
-- El repartidor es el primer rol con acceso restringido de verdad: solo ve
-- los pedidos que trae él, así que aquí sí se aprietan las políticas RLS
-- (hasta ahora cualquier staff autenticado podía leer y escribir todo).
--
-- Ejecutar en Supabase → SQL Editor después de 0010_whatsapp_realtime.sql.
--
-- Nota: las comparaciones usan `my_role()::text` a propósito. Postgres no deja
-- usar un valor de enum recién agregado dentro de la misma transacción; con el
-- cast a texto la migración corre completa de un solo Run.
-- ============================================================

alter type staff_role add value if not exists 'repartidor';

-- ---------- Pedidos: quién lo lleva ----------
alter table orders
  add column if not exists courier_id  uuid references auth.users (id) on delete set null,
  add column if not exists assigned_at timestamptz;

create index if not exists orders_courier_idx on orders (courier_id);

comment on column orders.courier_id is
  'Repartidor asignado (solo pedidos a domicilio). Se asigna al mandarlo en camino.';

-- ---------- Perfiles ----------
-- El mostrador necesita listar repartidores para asignarlos; antes solo el
-- admin podía leer perfiles ajenos.
drop policy if exists "perfil propio: leer" on profiles;
create policy "perfiles: leer" on profiles
  for select using (
    id = auth.uid() or my_role()::text in ('admin', 'cajero')
  );

-- ---------- Pedidos: el repartidor solo ve los suyos ----------
drop policy if exists "pedidos: leer staff" on orders;
create policy "pedidos: leer staff" on orders
  for select to authenticated using (
    my_role() is not null
    and (my_role()::text <> 'repartidor' or courier_id = auth.uid())
  );

drop policy if exists "pedidos: actualizar staff" on orders;
create policy "pedidos: actualizar staff" on orders
  for update to authenticated using (
    my_role() is not null
    and (my_role()::text <> 'repartidor' or courier_id = auth.uid())
  );

-- Las líneas y sus opciones siguen al pedido: el repartidor ve qué lleva.
drop policy if exists "items: leer staff" on order_items;
create policy "items: leer staff" on order_items
  for select to authenticated using (
    my_role() is not null
    and (
      my_role()::text <> 'repartidor'
      or exists (
        select 1 from orders o
        where o.id = order_items.order_id and o.courier_id = auth.uid()
      )
    )
  );

drop policy if exists "item_mods: leer staff" on order_item_modifiers;
create policy "item_mods: leer staff" on order_item_modifiers
  for select to authenticated using (
    my_role() is not null
    and (
      my_role()::text <> 'repartidor'
      or exists (
        select 1
        from order_items i
        join orders o on o.id = i.order_id
        where i.id = order_item_modifiers.order_item_id
          and o.courier_id = auth.uid()
      )
    )
  );

-- ---------- Todo lo demás queda fuera del alcance del repartidor ----------
-- Mismas políticas de antes + "y no seas repartidor". Para admin, cajero y
-- cocina no cambia nada.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('categories',      'catalogo: escritura staff'),
      ('products',        'productos: escritura staff'),
      ('modifiers',       'modifiers: escritura staff'),
      ('modifier_groups', 'modifier_groups: escritura staff'),
      ('inventory_moves', 'inventario: staff'),
      ('salas',           'salas: staff'),
      ('mesas',           'mesas: staff'),
      ('order_payments',  'pagos: staff'),
      ('cash_sessions',   'cajas: staff'),
      ('cash_movements',  'movimientos caja: staff'),
      ('wa_contacts',     'wa_contacts: staff'),
      ('wa_messages',     'wa_messages: staff'),
      ('wa_sessions',     'wa_sessions: staff')
    ) as x(tabla, politica)
  loop
    execute format('drop policy if exists %I on %I', t.politica, t.tabla);
    execute format(
      'create policy %I on %I for all to authenticated
         using (my_role() is not null and my_role()::text <> ''repartidor'')
         with check (my_role() is not null and my_role()::text <> ''repartidor'')',
      t.politica, t.tabla
    );
  end loop;
end $$;
