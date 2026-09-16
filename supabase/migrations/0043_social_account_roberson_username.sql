-- 0043_social_account_roberson_username.sql
-- The automated poller now also covers Roberson's personal Instagram
-- account. Set its ig_username so /api/social/followers can match the
-- ingest payload to the right row (same wiring already done for the
-- Franchising account in 0042).

update social_accounts set ig_username = 'roberson.alvarenga'
  where label = 'Roberson Alvarenga (pessoal)';
