-- ============================================================
-- 0009 — Bot de WhatsApp: estado de la conversación.
--
-- El bot es una máquina de estados y WhatsApp no guarda contexto: cada mensaje
-- llega suelto. Esta tabla es la memoria de "en qué paso va cada teléfono".
--
-- Ejecutar en Supabase SQL Editor después de 0008_whatsapp.sql.
-- ============================================================

create table wa_sessions (
  phone      text primary key,           -- E.164 sin '+', igual que wa_contacts
  state      text not null default 'inicio',
  -- Carrito en construcción, listados numerados vigentes, datos de entrega.
  -- Va en jsonb porque la forma cambia según el paso y no vale la pena
  -- normalizar algo que se borra al confirmar el pedido.
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Para barrer las conversaciones abandonadas (ver función de abajo).
create index wa_sessions_updated_idx on wa_sessions (updated_at);

-- Una conversación a medias que nadie retomó en 6 h ya no sirve: el cliente se
-- fue. Se limpia sola en el siguiente mensaje que entre, sin cron.
create or replace function public.wa_prune_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  delete from wa_sessions where updated_at < now() - interval '6 hours';
$$;

-- ---------- RLS ----------
-- Solo la escribe el servidor con la service_role (que ignora RLS); el staff
-- puede leerla desde el panel para depurar una conversación.
alter table wa_sessions enable row level security;

create policy "wa_sessions: staff" on wa_sessions
  for all to authenticated using (my_role() is not null) with check (my_role() is not null);

grant select, insert, update, delete on table wa_sessions to authenticated;
grant all privileges on table wa_sessions to service_role;
grant execute on function public.wa_prune_sessions() to service_role;
