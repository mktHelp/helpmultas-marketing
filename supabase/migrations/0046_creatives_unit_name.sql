-- 0046_creatives_unit_name.sql — qual unidade franqueada (quando unit = 'Unidade').

alter table creatives add column unit_name text not null default '';
