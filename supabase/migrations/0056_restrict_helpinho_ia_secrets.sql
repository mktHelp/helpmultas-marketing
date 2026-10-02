-- 0056_restrict_helpinho_ia_secrets.sql
-- O assistente (n8n) conecta como o role helpinho_ia, que desde a 0045 recebe
-- acesso a TODAS as tabelas do schema public (inclusive as criadas depois, via
-- default privileges). Isso incluiu instagram_tokens (0054), cujo access_token
-- nunca deve ser legível pelo assistente: a ferramenta de SQL livre poderia
-- devolvê-lo no chat. O sync do Instagram usa a service-role, então o
-- helpinho_ia não precisa dessa tabela.

revoke all on table instagram_tokens from helpinho_ia;
