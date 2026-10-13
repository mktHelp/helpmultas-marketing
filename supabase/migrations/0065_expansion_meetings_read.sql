-- 0065_expansion_meetings_read.sql — libera a aba Reuniões para a Expansão.
--
-- A aba lê landing_page_leads (leads + dados do CRM e resumo de reuniões) e
-- crm_lead_stage_history (histórico de etapas). Essas duas tabelas só tinham
-- policy de leitura para o time interno (is_internal_user), o que bloqueava o
-- papel "expansao". Agora qualquer usuário logado lê — igual às tabelas meta_*
-- (campanhas/conjuntos/anúncios) que a Expansão já enxerga. Escrita continua só
-- pelo service role / Master (server actions).

drop policy if exists "landing_page_leads_select" on landing_page_leads;
create policy "landing_page_leads_select" on landing_page_leads for select using (auth.uid() is not null);

drop policy if exists "crm_lead_stage_history_select" on crm_lead_stage_history;
create policy "crm_lead_stage_history_select" on crm_lead_stage_history for select using (auth.uid() is not null);
