-- 0061_profile_allowed_tabs.sql
-- Abas liberadas por usuário. NULL = acesso padrão do papel (tudo o que o papel
-- já enxergava, como antes). Array = só as abas listadas (chaves em
-- src/lib/access.ts: caminhos como '/tasks' e 'exp:dre' para a área da Expansão).
-- Master sempre enxerga tudo, independente deste campo.

alter table profiles add column if not exists allowed_tabs text[];

-- Novo usuário já nasce com as abas escolhidas no cadastro (metadata.allowed_tabs).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, department, job_title, allowed_tabs)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'membro'),
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'job_title',
    case when jsonb_typeof(new.raw_user_meta_data->'allowed_tabs') = 'array'
      then array(select jsonb_array_elements_text(new.raw_user_meta_data->'allowed_tabs'))
      else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- A policy "profiles_update_own" deixa cada um editar o próprio perfil; sem esta
-- trava, alguém poderia liberar abas para si. Só o Master (ou a service role,
-- que não tem auth.uid()) altera allowed_tabs.
create or replace function public.protect_allowed_tabs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.allowed_tabs is distinct from old.allowed_tabs
     and auth.uid() is not null
     and not public.is_admin() then
    new.allowed_tabs := old.allowed_tabs;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_allowed_tabs on profiles;
create trigger protect_allowed_tabs
  before update on profiles
  for each row execute function public.protect_allowed_tabs();
