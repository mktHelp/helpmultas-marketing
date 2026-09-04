-- 0026_creatives_top_ad.sql — coluna "Top Ads" (sim/não) na planilha de criativos.

alter table creatives add column top_ad boolean not null default false;
