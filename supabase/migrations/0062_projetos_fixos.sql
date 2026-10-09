-- Projetos fixos usados no "Nova tarefa" (chips) e exibidos nos cards.
insert into projects (name, description)
select v.name, v.description
from (values
  ('Franqueadora', 'Tarefas da franqueadora'),
  ('Mentoria', 'Tarefas da mentoria'),
  ('Roberson', 'Tarefas do Roberson')
) as v(name, description)
where not exists (select 1 from projects p where lower(p.name) = lower(v.name));
