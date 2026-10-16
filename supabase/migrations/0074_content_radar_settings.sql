-- 0074_content_radar_settings.sql — ajustes do Radar de Pauta editáveis pelo Hub
-- (modelo da IA, esforço de raciocínio, quantidade de pautas e preços para o cálculo de custo).
-- O workflow n8n lê esta linha a cada execução; sem a linha, usa o que está no nó Config.

create table if not exists content_radar_settings (
  id int primary key default 1 check (id = 1),
  model text not null default 'gpt-5-mini',
  reasoning_effort text not null default 'padrao' check (reasoning_effort in ('padrao', 'minimal', 'low', 'medium', 'high')),
  qtd_pautas int not null default 10 check (qtd_pautas between 4 and 20),
  price_in_usd_1m numeric(10, 4) not null default 0.25,   -- US$ por 1 milhão de tokens de entrada
  price_out_usd_1m numeric(10, 4) not null default 2.00,  -- US$ por 1 milhão de tokens de saída
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into content_radar_settings (id) values (1) on conflict do nothing;

alter table content_radar_settings enable row level security;
drop policy if exists "content_radar_settings_select" on content_radar_settings;
create policy "content_radar_settings_select" on content_radar_settings for select using (public.is_internal_user());
drop policy if exists "content_radar_settings_update" on content_radar_settings;
create policy "content_radar_settings_update" on content_radar_settings for update
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
