-- 0070_expansion_lead_validation_read.sql — libera a Validação de leads para a Expansão.
--
-- A aba lê lead_reconciliation_runs (retrato de cada ciclo) e meta_form_leads
-- (respostas do formulário nativo, no modal do lead). As duas só tinham leitura
-- para o time interno (is_internal_user), o que bloqueava o papel "expansao".
-- Mesmo critério da 0065 (Reuniões): qualquer usuário logado lê; escrita
-- continua só pelo service role (rota /api/leads/reconcile).

drop policy if exists "lead_reconciliation_runs_select" on lead_reconciliation_runs;
create policy "lead_reconciliation_runs_select" on lead_reconciliation_runs for select using (auth.uid() is not null);

drop policy if exists "meta_form_leads_select" on meta_form_leads;
create policy "meta_form_leads_select" on meta_form_leads for select using (auth.uid() is not null);
