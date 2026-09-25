-- 0047_expansion_role.sql — papel "expansao": contas do time de Expansão,
-- que só acessam a dash de criativos da Franqueadora (/expansao).
--
-- Fica sozinho neste arquivo porque um valor novo de enum não pode ser usado
-- na mesma transação em que foi criado; as policies que dependem dele estão
-- na 0048.

alter type user_role add value if not exists 'expansao';
