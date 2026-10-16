-- 0075_ai_usage_events.sql — registro de cada chamada de IA feita pelo Hub
-- (Helpinho, Teleprompter, variação de pauta, categorias da Expansão).
-- O Radar de Pauta continua em content_idea_runs; o painel Master junta as duas fontes.
-- Gravado pelas rotas do app com o service role; tokens vêm do n8n (nó "Medir Uso").

create table if not exists ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('helpinho', 'teleprompter', 'pauta_variacao', 'expansao_categoria')),
  user_id uuid references profiles(id) on delete set null,
  conversation_id uuid,
  model text,
  prompt_tokens int,
  completion_tokens int,
  cost_usd numeric(10, 6),
  estimated boolean not null default false, -- true = tokens estimados pelo tamanho do texto
  tool_calls int,                           -- quantas vezes o agente chamou ferramentas
  duration_ms int,
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_events_created on ai_usage_events(created_at desc);
create index if not exists idx_ai_usage_events_source on ai_usage_events(source, created_at desc);

alter table ai_usage_events enable row level security;
drop policy if exists "ai_usage_events_select" on ai_usage_events;
create policy "ai_usage_events_select" on ai_usage_events for select using (public.is_admin()); -- só o Master (painel em Configurações)
-- insert: só as rotas do app (service role), que ignoram o RLS.
