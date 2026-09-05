-- ============================================================
-- 0012 — Gestión de usuarios
--
-- Arregla un hueco que venía desde 0001: la política "perfil propio: editar"
-- dejaba que cualquiera reescribiera SU PROPIA fila de `profiles`, y eso
-- incluye la columna `role`. En la práctica, cualquier miembro del staff podía
-- ascenderse a admin llamando a la API de Supabase con la llave pública.
--
-- Ahora: cada quien edita su nombre, pero el rol solo lo cambia un admin.
--
-- Ejecutar en Supabase → SQL Editor después de 0011_repartidor.sql.
-- ============================================================

drop policy if exists "perfil propio: editar" on profiles;

create policy "perfiles: editar" on profiles
  for update to authenticated
  using (id = auth.uid() or my_role() = 'admin')
  with check (
    -- El admin puede cambiar cualquier perfil, rol incluido.
    my_role() = 'admin'
    -- Los demás: solo su propia fila y sin tocarse el rol. `my_role()` lee el
    -- valor de antes del update (es stable + security definer), así que esto
    -- compara el rol nuevo contra el que ya tenía.
    or (id = auth.uid() and role = my_role())
  );
