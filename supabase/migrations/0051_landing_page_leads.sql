-- 0051_landing_page_leads.sql — leads recebidos da LP (via POST
-- /api/leads, chamado em paralelo ao envio pro CRM), casados com a
-- campanha/conjunto/anúncio da Meta que gerou o clique através das UTMs
-- que a própria LP já rastreia. Permite ver de onde os leads vêm e montar
-- o ranking de anúncios que mais convertem.
--
-- Guarda o payload cru em raw_payload — se a LP adicionar um campo novo no
-- formulário amanhã, ele não se perde só porque a migration não sabia dele.

create table landing_page_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  state text not null default '',
  capital text not null default '',
  capital_label text not null default '',
  fbp text not null default '',
  fbc text not null default '',
  fbclid text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  utm_term text not null default '',
  utm_id text not null default '',
  -- Preenchidos pelo matching automático (ver app/api/leads/route.ts) —
  -- compara as UTMs acima com meta_campaigns/meta_ad_sets/meta_ads.
  matched_campaign_id uuid references meta_campaigns(id) on delete set null,
  matched_adset_id uuid references meta_ad_sets(id) on delete set null,
  matched_ad_id uuid references meta_ads(id) on delete set null,
  matched_by text,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_landing_page_leads_matched_ad on landing_page_leads(matched_ad_id);
create index idx_landing_page_leads_matched_campaign on landing_page_leads(matched_campaign_id);
create index idx_landing_page_leads_received_at on landing_page_leads(received_at);

alter table landing_page_leads enable row level security;

-- Dados de contato (nome/e-mail/telefone) são mais sensíveis que as
-- métricas agregadas de meta_*, então só o time interno lê — mesmo padrão
-- de meta_sync_runs (0049).
create policy "landing_page_leads_select" on landing_page_leads for select using (public.is_internal_user());

alter publication supabase_realtime add table landing_page_leads;
