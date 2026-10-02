-- 0057_avatars_bucket.sql
-- Foto de perfil: bucket público "avatars" (as fotos aparecem para o time todo
-- — responsáveis, comentários, menu — então a URL pública evita assinar link
-- a cada render). Cada pessoa só grava/troca/apaga arquivos dentro da própria
-- pasta (<user_id>/...). O caminho da foto fica em profiles.avatar_url.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
