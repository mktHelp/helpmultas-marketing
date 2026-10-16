-- 0071_task_color.sql — cor opcional por tarefa (card do Kanban e chip do Calendário).
alter table tasks add column if not exists color text;
