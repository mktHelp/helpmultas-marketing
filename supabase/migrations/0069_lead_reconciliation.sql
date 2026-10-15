-- 0069_lead_reconciliation.sql — validação de leads a cada 3h
-- (GET /api/leads/reconcile, disparado pelo GitHub Actions).
--
-- meta_form_leads: cópia dos leads do formulário nativo da Meta, puxados da
-- Graph API (/{ad_id}/leads) — é a lista "verdade" do nativo, independente
-- do CRM (hoje o nativo só chegava ao Hub pelo export do CRM).
--
-- lead_reconciliation_runs: um retrato por ciclo — totais e as listas de
-- leads fora do CRM e duplicados, lidos pela página /trafego-pago/leads/validacao.

create table if not exists meta_form_leads (
  leadgen_id text primary key,
  form_id text not null default '',
  meta_ad_id text not null default '',
  ad_name text not null default '',
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  phone_digits text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  field_data jsonb not null default '[]'::jsonb,
  created_time timestamptz not null,
  synced_at timestamptz not null default now()
);

create index if not exists idx_meta_form_leads_created on meta_form_leads(created_time);
create index if not exists idx_meta_form_leads_phone on meta_form_leads(phone_digits);

alter table meta_form_leads enable row level security;
create policy "meta_form_leads_select" on meta_form_leads for select using (public.is_internal_user());

create table if not exists lead_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running', -- running | success | error
  error text,
  window_since timestamptz,
  summary jsonb not null default '{}'::jsonb,
  issues jsonb not null default '{}'::jsonb
);

create index if not exists idx_lead_reconciliation_runs_started on lead_reconciliation_runs(started_at desc);

alter table lead_reconciliation_runs enable row level security;
create policy "lead_reconciliation_runs_select" on lead_reconciliation_runs for select using (public.is_internal_user());
