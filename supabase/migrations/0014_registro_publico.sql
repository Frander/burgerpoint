-- ============================================================
-- 0014 — Cerrar el registro público como staff
--
-- EL HUECO (encontrado el 12 sep 2026, estaba abierto en producción):
-- `profiles.role` nace en 'cajero' (0001) y el disparador on_auth_user_created
-- le creaba perfil a CUALQUIER usuario nuevo de auth.users. Como el registro
-- público está habilitado y la llave anon va en el navegador, cualquier persona
-- de internet podía registrarse y quedar de cajera: comprobado leyendo pedidos
-- (nombres, teléfonos y direcciones de clientes), conversaciones de WhatsApp y
-- la lista del staff.
--
-- EL ARREGLO: el disparador solo crea perfil si el alta viene marcada como
-- staff (`raw_user_meta_data ->> 'staff' = 'true'`), cosa que únicamente hace
-- la pantalla de Usuarios con la llave de servicio. Quien se registre por su
-- cuenta se queda SIN perfil, y sin perfil `my_role()` devuelve null: las
-- políticas RLS le niegan todo.
--
-- Los clientes del programa de puntos no usan auth.users, así que este candado
-- no les estorba.
--
-- Ejecutar en Supabase → SQL Editor después de 0013_ajustes.sql.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo el alta hecha desde el panel (llave de servicio) marca 'staff'.
  if coalesce(new.raw_user_meta_data ->> 'staff', '') <> 'true' then
    return new;
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Red de seguridad para lo ya creado: si alguien se coló antes de este arreglo,
-- aquí se ve. No se borra nada solo — que lo revise una persona.
do $$
declare
  sospechosos int;
begin
  select count(*) into sospechosos
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(u.raw_user_meta_data ->> 'staff', '') <> 'true';

  if sospechosos > 0 then
    raise notice 'Revisa /admin/usuarios: % perfiles existían antes del candado.', sospechosos;
  end if;
end $$;
