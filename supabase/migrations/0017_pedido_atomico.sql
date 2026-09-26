-- ============================================================
-- 0017 — Crear el pedido y sus productos en una sola transacción
--
-- Antes el servidor insertaba el pedido y luego cada producto por separado.
-- Realtime avisa del pedido en cuanto existe, así que el PDV, la cocina y el
-- agente de impresión lo leían a medias: salía el ticket sin algunos
-- productos y solo al reimprimir aparecían todos.
--
-- Dentro de una función todo se confirma junto: nadie ve el pedido hasta que
-- ya tiene todas sus líneas y opciones. Son SECURITY INVOKER a propósito: se
-- aplican las mismas políticas RLS que al insertar directo (el cliente
-- anónimo puede crear pedidos, no leerlos).
--
-- Ejecutar con `supabase db push` después de 0016_whatsapp_leidos.sql.
-- ============================================================

-- Líneas (con sus opciones) de un pedido que ya existe. La usa create_order y
-- también el PDV al agregar productos a una cuenta abierta.
create or replace function public.insert_order_items(p_order_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  it        jsonb;
  v_item_id uuid;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_item_id := coalesce((it ->> 'id')::uuid, gen_random_uuid());

    insert into order_items (id, order_id, product_id, product_name, quantity, unit_price, notes)
    values (
      v_item_id,
      p_order_id,
      (it ->> 'product_id')::uuid,
      it ->> 'product_name',
      (it ->> 'quantity')::int,
      (it ->> 'unit_price')::numeric,
      nullif(it ->> 'notes', '')
    );

    insert into order_item_modifiers (order_item_id, modifier_name, extra_price, group_name)
    select v_item_id,
           m ->> 'modifier_name',
           coalesce((m ->> 'extra_price')::numeric, 0),
           m ->> 'group_name'
    from jsonb_array_elements(coalesce(it -> 'modifiers', '[]'::jsonb)) as m;
  end loop;
end;
$$;

-- Pedido completo: encabezado + líneas + opciones, todo o nada.
create or replace function public.create_order(p_order jsonb, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id uuid := (p_order ->> 'id')::uuid;
begin
  insert into orders (
    id, code, customer_name, customer_phone, type, address, notes, total,
    origin, status, delivery_fee, discount, coupon_id, mesa_id, served_by
  )
  values (
    v_order_id,
    p_order ->> 'code',
    p_order ->> 'customer_name',
    p_order ->> 'customer_phone',
    (p_order ->> 'type')::order_type,
    p_order ->> 'address',
    p_order ->> 'notes',
    (p_order ->> 'total')::numeric,
    coalesce((p_order ->> 'origin')::order_origin, 'web'),
    coalesce((p_order ->> 'status')::order_status, 'nuevo'),
    coalesce((p_order ->> 'delivery_fee')::numeric, 0),
    coalesce((p_order ->> 'discount')::numeric, 0),
    (p_order ->> 'coupon_id')::uuid,
    (p_order ->> 'mesa_id')::uuid,
    p_order ->> 'served_by'
  );

  perform insert_order_items(v_order_id, p_items);
end;
$$;

grant execute on function public.insert_order_items(uuid, jsonb) to anon, authenticated, service_role;
grant execute on function public.create_order(jsonb, jsonb) to anon, authenticated, service_role;
