-- ============================================================
-- 0008 — WhatsApp (API oficial de Meta / Cloud API).
--
-- Cubre las tres funciones:
--   1. Alerta interna a un número cuando entra un pedido.
--   2. Avisos de cambio de estado al cliente.
--   3. Bot que recibe pedidos por WhatsApp.
--
-- Ejecutar en Supabase SQL Editor después de 0007_caja.sql.
-- ============================================================

-- Los pedidos que cree el bot se distinguen en el panel y en los reportes,
-- que ya desglosan por origen.
alter type order_origin add value if not exists 'whatsapp';

-- ---------- Contactos ----------
-- `last_inbound_at` es la pieza que ahorra dinero: Meta cobra la plantilla
-- solo si la mandas FUERA de las 24 h desde el último mensaje del cliente.
-- Dentro de esa ventana el mensaje va como texto libre y es gratis.
create table wa_contacts (
  phone           text primary key,          -- E.164 sin '+' (ej. 5219991234567)
  name            text,
  last_inbound_at timestamptz,
  opted_out       boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ---------- Bitácora de mensajes ----------
-- `wamid` es el id que asigna Meta. Va con UNIQUE porque el webhook reintenta
-- el mismo evento si no respondemos 200 a tiempo: así no se procesa dos veces.
create table wa_messages (
  id            uuid primary key default gen_random_uuid(),
  direction     text not null check (direction in ('in', 'out')),
  phone         text not null,
  wamid         text unique,
  kind          text,                        -- 'text' | 'template'
  template_name text,
  -- Identifica el aviso ('alerta', 'estado:listo'…) sin importar si al final
  -- salió como plantilla o como texto libre, que depende de la ventana de 24 h.
  dedupe_tag    text,
  body          text,
  order_id      uuid references orders (id) on delete set null,
  status        text,                        -- 'pending' | 'sent' | 'failed'
  error         text,
  payload       jsonb,
  created_at    timestamptz not null default now()
);
create index wa_messages_phone_idx on wa_messages (phone, created_at desc);
create index wa_messages_order_idx on wa_messages (order_id);

-- Idempotencia: el mismo aviso del mismo pedido no se manda dos veces aunque
-- la acción se reintente o alguien haga doble clic. La fila se inserta ANTES
-- de llamar a Meta, así que el choque de este índice es la señal de "ya se
-- mandó" y el envío se cancela.
create unique index wa_messages_order_tag_idx
  on wa_messages (order_id, dedupe_tag)
  where direction = 'out' and order_id is not null and dedupe_tag is not null;

-- ---------- RLS ----------
-- Nada de esto es público: lo escribe el servidor con la service_role (que
-- ignora RLS) y lo lee el staff desde el panel.
alter table wa_contacts enable row level security;
alter table wa_messages enable row level security;

create policy "wa_contacts: staff" on wa_contacts
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);
create policy "wa_messages: staff" on wa_messages
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

-- ---------- GRANTs (las políticas no bastan en Supabase) ----------
grant select, insert, update, delete on table wa_contacts, wa_messages to authenticated;
grant all privileges on table wa_contacts, wa_messages to service_role;
