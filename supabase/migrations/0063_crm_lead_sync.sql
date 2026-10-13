-- 0063_crm_lead_sync.sql — leads exportados pelo CRM (webhook leads.export,
-- a cada 3h, POST /api/crm/leads-export). O CRM manda o retrato atual de cada
-- lead; aqui ele atualiza o mesmo registro de landing_page_leads (chave:
-- crm_lead_id) com funil/etapa e o resumo de reuniões, e cada mudança de etapa
-- vira uma linha em crm_lead_stage_history pra acompanhar o funil.

alter table landing_page_leads
  add column if not exists crm_lead_id text,
  add column if not exists crm_funnel_name text,
  add column if not exists crm_stage_name text,
  add column if not exists crm_previous_stage_name text,
  add column if not exists crm_phase_name text,
  add column if not exists crm_category_name text,
  add column if not exists crm_source text,
  add column if not exists crm_stage_entered_at timestamptz,
  add column if not exists crm_last_movement_at timestamptz,
  add column if not exists crm_synced_at timestamptz,
  add column if not exists meetings_count integer not null default 0,
  add column if not exists meetings_no_show integer not null default 0,
  add column if not exists meetings_rescheduled integer not null default 0,
  add column if not exists first_meeting_at timestamptz,
  add column if not exists last_meeting_at timestamptz,
  add column if not exists last_meeting_status text,
  -- Só dígitos, pra casar o telefone do CRM (554198405563) com o da LP
  -- (formatado) sem depender da máscara.
  add column if not exists phone_digits text
    generated always as (regexp_replace(phone, '\D', '', 'g')) stored;

create unique index if not exists uq_landing_page_leads_crm_lead_id on landing_page_leads(crm_lead_id);
create index if not exists idx_landing_page_leads_phone_digits on landing_page_leads(phone_digits);
create index if not exists idx_landing_page_leads_email on landing_page_leads(lower(email));
create index if not exists idx_landing_page_leads_crm_stage on landing_page_leads(crm_stage_name);
create index if not exists idx_landing_page_leads_meetings on landing_page_leads(meetings_count) where meetings_count > 0;

create table if not exists crm_lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references landing_page_leads(id) on delete cascade,
  stage_name text not null default '',
  previous_stage_name text,
  phase_name text,
  category_name text,
  entered_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (lead_id, entered_at)
);

create index if not exists idx_crm_stage_history_lead on crm_lead_stage_history(lead_id);
create index if not exists idx_crm_stage_history_stage on crm_lead_stage_history(stage_name, entered_at);

alter table crm_lead_stage_history enable row level security;

create policy "crm_lead_stage_history_select" on crm_lead_stage_history for select using (public.is_internal_user());
