-- 0059_ad_script_links.sql
-- Vínculo entre anúncios (Tráfego Pago) e os roteiros do Teleprompter que
-- deram origem a eles. Serve para: (1) saber de qual roteiro é cada criativo
-- do ranking de leads; (2) a IA (Helpinho) aprender quais tipos de roteiro
-- convertem e usar isso ao escrever novos.
-- Fica numa tabela própria (e não em meta_ads) porque meta_ads é reescrita pelo
-- job de sync com a service role, e aqui o time interno precisa gravar direto.
-- Um anúncio tem no máximo um roteiro; um roteiro pode estar em vários anúncios.

create table meta_ad_scripts (
  ad_id uuid primary key references meta_ads(id) on delete cascade,
  script_id uuid not null references teleprompter_scripts(id) on delete cascade,
  linked_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_meta_ad_scripts_script on meta_ad_scripts(script_id);

alter table meta_ad_scripts enable row level security;

create policy "meta_ad_scripts_select" on meta_ad_scripts for select using (public.is_internal_user());
create policy "meta_ad_scripts_insert" on meta_ad_scripts for insert with check (public.is_internal_user());
create policy "meta_ad_scripts_update" on meta_ad_scripts for update using (public.is_internal_user());
create policy "meta_ad_scripts_delete" on meta_ad_scripts for delete using (public.is_internal_user());

grant select, insert, update, delete on meta_ad_scripts to authenticated, service_role;

alter publication supabase_realtime add table meta_ad_scripts;
