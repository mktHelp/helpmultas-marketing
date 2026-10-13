-- 0064_lead_admin.sql — exclusão e edição manual de leads (só Master).
--
-- O CRM reenvia a base inteira a cada 3h (POST /api/crm/leads-export), então
-- um lead excluído aqui voltaria no envio seguinte. deleted_crm_leads guarda o
-- id do CRM de cada lead excluído e o endpoint passa a ignorá-lo.
--
-- crm_locked: quando o Master corrige à mão os dados vindos do CRM (etapa,
-- categoria, reuniões), a sincronização deixa de sobrescrevê-los.

create table if not exists deleted_crm_leads (
  crm_lead_id text primary key,
  name text not null default '',
  deleted_by uuid references profiles(id) on delete set null,
  deleted_at timestamptz not null default now()
);

-- Sem policies: só o service role (server actions e o endpoint do CRM) acessa.
alter table deleted_crm_leads enable row level security;

alter table landing_page_leads
  add column if not exists crm_locked boolean not null default false;
