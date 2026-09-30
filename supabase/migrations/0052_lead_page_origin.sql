-- 0052_lead_page_origin.sql — de qual página da LP o lead veio (home, evento…).
-- Separado de utm_source (que é a origem de TRÁFEGO, vinda da URL): este campo
-- é a página em que o formulário foi preenchido. Leads anteriores a esta
-- migration vieram todos da home (o evento só passou a enviar depois).

alter table landing_page_leads
  add column if not exists page_origin text not null default 'home';

create index if not exists idx_landing_page_leads_page_origin on landing_page_leads(page_origin);
