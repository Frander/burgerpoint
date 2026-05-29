-- ============================================================
-- Burger Point — Storage para fotos de productos
-- Ejecutar en Supabase: SQL Editor > pegar y Run.
-- Crea un bucket público y las políticas de acceso.
-- ============================================================

-- Bucket público (las imágenes se sirven sin autenticación; las puede ver
-- cualquiera que entre al storefront). 5 MB por archivo, solo imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Políticas (objetos del bucket) ----------

-- Lectura pública (el bucket ya es público, pero dejamos la política explícita).
drop policy if exists "product-images public read" on storage.objects;
create policy "product-images public read"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

-- Subir / reemplazar / borrar: solo staff autenticado.
drop policy if exists "product-images staff insert" on storage.objects;
create policy "product-images staff insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "product-images staff update" on storage.objects;
create policy "product-images staff update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "product-images staff delete" on storage.objects;
create policy "product-images staff delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');
