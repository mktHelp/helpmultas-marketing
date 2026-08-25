-- 0004_seed_reference.sql — reference data that does not depend on auth users
-- (users, projects, campaigns and tasks are seeded via scripts/seed-demo.ts
-- because they require auth.users records created through the Admin API)

insert into areas (name, description, color, sort_order) values
  ('Marketing', 'Estratégia geral e planejamento do departamento', '#243746', 0),
  ('Social Media', 'Gestão de redes sociais e comunidade', '#fcbf00', 1),
  ('Design', 'Peças gráficas, criativos e identidade visual', '#4a6a80', 2),
  ('Vídeo', 'Roteiro, gravação e edição de vídeo', '#375367', 3),
  ('Copywriting', 'Textos, legendas e copy publicitário', '#2c4356', 4),
  ('Tráfego Pago', 'Meta Ads, Google Ads e mídia paga', '#e0a900', 5),
  ('Conteúdo', 'Produção editorial e calendário de conteúdo', '#7c8e98', 6),
  ('Eventos', 'Eventos institucionais e franquias', '#1b2a34', 7)
on conflict (name) do nothing;

insert into categories (name, area_id)
select c.name, a.id from (values
  ('Reels', 'Social Media'), ('Stories', 'Social Media'), ('Feed', 'Social Media'),
  ('Roteiro', 'Vídeo'), ('Gravação', 'Vídeo'), ('Edição', 'Vídeo'),
  ('Criativos', 'Design'), ('Peças institucionais', 'Design'),
  ('Legenda', 'Copywriting'), ('Blog', 'Copywriting'), ('E-mail marketing', 'Copywriting'),
  ('Meta Ads', 'Tráfego Pago'), ('Google Ads', 'Tráfego Pago'), ('Landing Page', 'Tráfego Pago'),
  ('Calendário editorial', 'Conteúdo'), ('Helpcast', 'Conteúdo'),
  ('Planejamento', 'Marketing'), ('Relatórios', 'Marketing')
) as c(name, area_name)
join areas a on a.name = c.area_name
on conflict do nothing;

insert into tags (name, color) values
  ('urgente-cliente', '#c23b3b'),
  ('institucional', '#243746'),
  ('franquias', '#4a6a80'),
  ('performance', '#e0a900'),
  ('recorrente', '#7c8e98'),
  ('aprovação-pendente', '#fcbf00')
on conflict (name) do nothing;

insert into task_templates (name, description, area_id, content_type, checklist_items)
select 'Template — Reels', 'Fluxo padrão de produção de Reels', a.id, 'reels',
  '[{"title":"Definir ideia","sort_order":0},{"title":"Criar roteiro","sort_order":1},{"title":"Aprovar roteiro","sort_order":2},{"title":"Gravar","sort_order":3},{"title":"Editar","sort_order":4},{"title":"Revisar","sort_order":5},{"title":"Aprovar","sort_order":6},{"title":"Criar legenda","sort_order":7},{"title":"Publicar","sort_order":8}]'::jsonb
from areas a where a.name = 'Social Media'
on conflict do nothing;

insert into task_templates (name, description, area_id, checklist_items)
select 'Template — Campanha', 'Fluxo padrão de lançamento de campanha', a.id,
  '[{"title":"Briefing","sort_order":0},{"title":"Planejamento","sort_order":1},{"title":"Criativos","sort_order":2},{"title":"Copy","sort_order":3},{"title":"Landing Page","sort_order":4},{"title":"Tráfego","sort_order":5},{"title":"Aprovação","sort_order":6},{"title":"Publicação","sort_order":7},{"title":"Análise","sort_order":8}]'::jsonb
from areas a where a.name = 'Marketing'
on conflict do nothing;
