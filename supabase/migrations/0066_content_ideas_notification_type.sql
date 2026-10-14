-- 0066_content_ideas_notification_type.sql
-- Rode este arquivo SOZINHO (antes do 0067) — o Postgres não deixa usar um valor
-- novo de enum na mesma transação que o cria.

alter type notification_type add value if not exists 'content_ideas';
