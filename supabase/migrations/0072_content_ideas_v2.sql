-- 0072_content_ideas_v2.sql — Pautas do Dia v2: tema, frescor da notícia, nota
-- detalhada, checagem de fatos, variações e agendamento.
-- Rode ANTES de importar o workflow n8n novo (ele grava estas colunas).

alter table content_ideas
  add column if not exists theme text,                       -- tema curto para agrupar ("CNH digital")
  add column if not exists source_published_at timestamptz,  -- quando a notícia saiu
  add column if not exists source_tier int,                  -- 1 = oficial, 2 = grande portal, 3 = demais
  add column if not exists score_breakdown jsonb,            -- {bolso, alcance, frescor, polemica} de 0 a 25
  add column if not exists needs_check boolean not null default false,
  add column if not exists check_note text,                  -- o que conferir antes de publicar
  add column if not exists variation_of uuid references content_ideas(id) on delete set null;

-- Variações são criadas pelo Hub (rota /api/pautas/variation, service role).
create index if not exists idx_content_ideas_theme on content_ideas(batch_date desc, theme);
