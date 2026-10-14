-- 0067_content_ideas.sql — "Pautas do Dia": ideias de conteúdo geradas pelo
-- workflow n8n "Radar de Pauta" (2x por dia), a partir de notícias de trânsito
-- do dia + o que já performou nas contas da Help. Rode o 0066 antes.

create table if not exists content_ideas (
  id uuid primary key default gen_random_uuid(),
  batch_date date not null default (now() at time zone 'America/Sao_Paulo')::date,
  period text not null default 'manha' check (period in ('manha', 'tarde')),
  account text not null check (account in ('franchising', 'roberson')),
  format text not null check (format in ('reels', 'feed', 'carrossel', 'stories')),
  title text not null,
  hook text,
  script text,
  caption text,
  cta text,
  why text,                    -- por que deve funcionar (padrão que está performando)
  reference_permalink text,    -- post da casa / referência que inspirou
  reference_note text,
  source_title text,
  source_url text,
  source_name text,
  score int check (score between 0 and 100),
  status text not null default 'nova' check (status in ('nova', 'aprovada', 'descartada')),
  task_id uuid references tasks(id) on delete set null,
  teleprompter_script_id uuid references teleprompter_scripts(id) on delete set null,
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_ideas_batch on content_ideas(batch_date desc, period, score desc);
create index if not exists idx_content_ideas_source on content_ideas(source_url);

alter table content_ideas enable row level security;
drop policy if exists "content_ideas_select" on content_ideas;
create policy "content_ideas_select" on content_ideas for select using (public.is_internal_user());
drop policy if exists "content_ideas_update" on content_ideas;
create policy "content_ideas_update" on content_ideas for update using (public.is_internal_user());
-- insert: só o n8n (conexão Postgres direta / service role), que ignora o RLS.

-- Perfis externos de referência (lidos via Instagram Business Discovery, grátis).
-- Só funciona com contas Business/Creator; um @ inválido é ignorado pelo workflow.
create table if not exists content_reference_profiles (
  username text primary key,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table content_reference_profiles enable row level security;
drop policy if exists "content_reference_profiles_all" on content_reference_profiles;
create policy "content_reference_profiles_all" on content_reference_profiles for all
  using (public.is_internal_user()) with check (public.is_internal_user());

insert into content_reference_profiles (username, label) values
  ('doutormultas', 'Doutor Multas'),
  ('prfbrasil', 'PRF'),
  ('detran.sp', 'Detran-SP'),
  ('portaldotransito', 'Portal do Trânsito'),
  ('autoesporte', 'Autoesporte'),
  ('quatrorodas', 'Quatro Rodas')
on conflict do nothing;

-- Avisa o time interno (sininho + bolinha na aba "Pautas") que chegou um lote novo.
create or replace function public.notify_content_ideas(p_count int, p_period text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into notifications (user_id, type, title, message)
  select p.id, 'content_ideas',
         '☀️ ' || p_count || ' pautas novas (' || case when p_period = 'tarde' then 'tarde' else 'manhã' end || ')',
         'O Helpinho garimpou notícias de trânsito de hoje e montou ideias para Reels, Feed e Stories.'
  from profiles p
  where p.role <> 'expansao' and p_count > 0;
$$;
revoke execute on function public.notify_content_ideas(int, text) from public, anon, authenticated;

-- Execuções do Radar de Pauta (agendadas ou pelo botão "Gerar pautas agora").
-- O n8n vai atualizando step/step_label; o Hub acompanha via Realtime.
-- Só pode haver UMA execução rodando por vez (índice único parcial) — é isso
-- que impede cliques repetidos de dispararem várias execuções.
create table if not exists content_idea_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'agendado' check (source in ('agendado', 'manual')),
  triggered_by uuid references profiles(id) on delete set null,
  status text not null default 'running' check (status in ('running', 'done', 'error')),
  step int not null default 1,
  step_label text not null default 'Iniciando',
  ideas_count int,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists content_idea_runs_one_running on content_idea_runs ((true)) where status = 'running';
create index if not exists idx_content_idea_runs_started on content_idea_runs(started_at desc);

alter table content_idea_runs enable row level security;
drop policy if exists "content_idea_runs_select" on content_idea_runs;
create policy "content_idea_runs_select" on content_idea_runs for select using (public.is_internal_user());
-- escrita: só service role (rota /api/pautas/run) e n8n (Postgres direto).

do $$
declare t text;
begin
  foreach t in array array['content_idea_runs', 'content_ideas'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
