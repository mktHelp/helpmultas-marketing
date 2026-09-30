-- 0054_instagram_tokens.sql
-- Tokens do Instagram Login (um por perfil, longa duração ~60 dias, renovados
-- pelo sync). RLS ligado e SEM policies de propósito: só a service-role lê,
-- nunca o front (social_accounts é legível por qualquer usuário logado).

create table instagram_tokens (
  account_id uuid primary key references social_accounts(id) on delete cascade,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table instagram_tokens enable row level security;

-- Garante o ig_username do perfil pessoal do Rober (usado só como referência).
update social_accounts set ig_username = 'roberson.alvarenga'
  where label = 'Roberson Alvarenga (pessoal)' and ig_username is null;
