-- 0048_expansion_rls.sql — isola o papel "expansao" (ver 0047).
--
-- As policies existentes liberam quase tudo para qualquer usuário logado.
-- Em vez de reescrever cada uma, somamos policies RESTRICTIVE: o Postgres
-- exige que elas passem *além* das permissivas, então para o time interno
-- nada muda e para a expansão tudo fica bloqueado, exceto:
--   * creatives: somente leitura, somente unit = 'Franqueadora';
--   * profiles: o próprio perfil e os perfis de quem entregou esses criativos.

-- Mesmo padrão de is_admin(): security definer (dono postgres) para ler
-- profiles sem passar pelo RLS e sem recursão.
create or replace function public.is_internal_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role <> 'expansao' from profiles where id = auth.uid()), false);
$$;

revoke execute on function public.is_internal_user() from public, anon;
grant execute on function public.is_internal_user() to authenticated;

-- ============================================================
-- Todas as tabelas com RLS, menos profiles e creatives: só time interno.
-- Tabelas criadas no futuro precisam receber a mesma policy.
-- ============================================================
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and c.relname not in ('profiles', 'creatives')
  loop
    execute format('drop policy if exists internal_users_only on public.%I', t.relname);
    execute format(
      'create policy internal_users_only on public.%I as restrictive for all to authenticated '
      'using (public.is_internal_user()) with check (public.is_internal_user())',
      t.relname
    );
  end loop;
end $$;

-- ============================================================
-- CREATIVES: expansão lê só os da Franqueadora e não escreve nada.
-- ============================================================
drop policy if exists creatives_expansion_select on creatives;
create policy creatives_expansion_select on creatives as restrictive for select to authenticated
  using (public.is_internal_user() or unit = 'Franqueadora');

drop policy if exists creatives_internal_insert on creatives;
create policy creatives_internal_insert on creatives as restrictive for insert to authenticated
  with check (public.is_internal_user());

drop policy if exists creatives_internal_update on creatives;
create policy creatives_internal_update on creatives as restrictive for update to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists creatives_internal_delete on creatives;
create policy creatives_internal_delete on creatives as restrictive for delete to authenticated
  using (public.is_internal_user());

-- ============================================================
-- PROFILES: expansão vê o próprio perfil e quem entregou os criativos
-- visíveis a ela; não altera nenhum perfil (nem o próprio papel).
-- ============================================================
drop policy if exists profiles_expansion_select on profiles;
create policy profiles_expansion_select on profiles as restrictive for select to authenticated
  using (
    public.is_internal_user()
    or id = auth.uid()
    or id in (select delivered_by from creatives where unit = 'Franqueadora')
  );

drop policy if exists profiles_internal_insert on profiles;
create policy profiles_internal_insert on profiles as restrictive for insert to authenticated
  with check (public.is_internal_user());

drop policy if exists profiles_internal_update on profiles;
create policy profiles_internal_update on profiles as restrictive for update to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists profiles_internal_delete on profiles;
create policy profiles_internal_delete on profiles as restrictive for delete to authenticated
  using (public.is_internal_user());

-- ============================================================
-- STORAGE (anexos de tarefas, fotos de aniversário): só time interno.
-- ============================================================
drop policy if exists internal_users_only on storage.objects;
create policy internal_users_only on storage.objects as restrictive for all to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());
