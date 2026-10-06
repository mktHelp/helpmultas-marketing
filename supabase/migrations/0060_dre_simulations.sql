-- 0060_dre_simulations.sql
-- Simulações da DRE do franqueado (aba DRE da Expansão), vinculadas ao nome do
-- lead. `inputs` guarda tudo que foi preenchido (permite reabrir/recalcular);
-- `summary` guarda um resumo do resultado (retorno, casos/mês etc.) para
-- consultar sem recalcular. Uma simulação por lead: salvar de novo atualiza.
-- Time interno e Expansão leem e gravam (a Expansão é quem usa a DRE).

create table dre_simulations (
  id uuid primary key default gen_random_uuid(),
  lead_name text not null,
  region text not null default 'Brasil',
  inputs jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Roberson" e "roberson " são o mesmo lead.
create unique index uq_dre_simulations_lead on dre_simulations (lower(btrim(lead_name)));
create index idx_dre_simulations_updated on dre_simulations (updated_at desc);

alter table dre_simulations enable row level security;

create policy "dre_simulations_select" on dre_simulations for select to authenticated using (true);
create policy "dre_simulations_insert" on dre_simulations for insert to authenticated with check (true);
create policy "dre_simulations_update" on dre_simulations for update to authenticated using (true) with check (true);
create policy "dre_simulations_delete" on dre_simulations for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

grant select, insert, update, delete on dre_simulations to authenticated, service_role;
