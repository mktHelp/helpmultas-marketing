-- 0073_content_idea_runs_cost.sql — gasto da IA por execução do Radar de Pauta.
-- O workflow n8n grava os tokens que a OpenAI devolve e o custo calculado com os
-- preços do nó Config. Rode antes de importar o workflow que grava estas colunas.

alter table content_idea_runs
  add column if not exists model text,
  add column if not exists news_count int,
  add column if not exists prompt_tokens int,
  add column if not exists completion_tokens int,
  add column if not exists cost_usd numeric(10, 5);
