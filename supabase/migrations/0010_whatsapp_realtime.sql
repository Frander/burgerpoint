-- ============================================================
-- 0010 — Realtime para la bandeja de WhatsApp del admin.
--
-- Sin esto la pantalla /admin/whatsapp no recibe mensajes ni contactos
-- nuevos en vivo (se ve al recargar, pero no en el momento).
-- ============================================================

alter publication supabase_realtime add table wa_contacts;
alter publication supabase_realtime add table wa_messages;
