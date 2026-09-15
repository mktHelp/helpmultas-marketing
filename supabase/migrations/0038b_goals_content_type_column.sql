-- 0038b_goals_content_type_column.sql
-- Run AFTER 0038 (separate transaction, since the CHECK constraint below
-- references the enum value that 0038 just added).

alter table goals add column content_type content_type;

alter table goals add constraint goals_content_type_requires_metric
  check (metric <> 'content_published' or content_type is not null);
