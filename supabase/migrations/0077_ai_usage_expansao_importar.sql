-- 0077_ai_usage_expansao_importar.sql
-- Nova origem de uso de IA: importação de arquivos no Processo comercial da Expansão.

alter table ai_usage_events drop constraint if exists ai_usage_events_source_check;
alter table ai_usage_events add constraint ai_usage_events_source_check
  check (source in ('helpinho', 'teleprompter', 'pauta_variacao', 'expansao_categoria', 'expansao_importar'));
