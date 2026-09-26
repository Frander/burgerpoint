-- ============================================================
-- 0016 — Conversaciones de WhatsApp sin leer
--
-- Una conversación está "sin leer" cuando el cliente escribió después de la
-- última vez que alguien del staff la abrió (last_inbound_at > last_read_at).
-- Se guarda en la base y no en el navegador para que, si la caja la lee, deje
-- de aparecer pendiente también en la computadora del admin.
--
-- Ejecutar con `supabase db push` después de 0015_clientes_puntos.sql.
-- ============================================================

alter table wa_contacts add column if not exists last_read_at timestamptz;

-- Lo que ya estaba en la bandeja se da por leído: si no, al estrenar esto
-- aparecerían como pendientes conversaciones de hace semanas.
update wa_contacts set last_read_at = now() where last_read_at is null;
