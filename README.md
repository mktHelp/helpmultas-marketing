# Marketing Hub — Help Multas

Sistema de gestão de tarefas do time de Marketing da Help Multas. Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase (Auth, Postgres, RLS, Storage), com o Design System da marca aplicado em todos os componentes.

## O que já está pronto

- **Autenticação** com Supabase Auth (login, sessão via cookies, proxy de sessão)
- **Permissões por função**: Master, Gestor, Membro (RLS no banco, não só na UI)
- **Tarefas**: CRUD completo, detalhe, checklist, comentários, anexos (Storage), histórico/auditoria, tags, duplicar, arquivar
- **Quadro Kanban** com drag-and-drop (atualiza o status no banco)
- **Tabela de tarefas** com filtros, busca, seleção múltipla e ações em massa
- **Dashboard** com KPIs, gráficos (área, status, produtividade) e ranking da equipe
- **Meu Dia**, **Minhas Tarefas**, **Calendário**, **Projetos**, **Campanhas**, **Conteúdos**, **Equipe**, **Relatórios** (com exportação CSV), **Configurações** (usuários, áreas, categorias, tags)
- **Notificações** in-app e **busca global** (Ctrl+K)
- **Templates de tarefa** e estrutura de **tarefas recorrentes** no banco

## Passo a passo — configurar o Supabase do zero

### 1. Criar o projeto

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (ou entre com a sua).
2. Clique em **New Project**.
3. Escolha uma organização, dê um nome (ex: `helpmultas-marketing`), defina uma senha forte do banco (guarde-a) e escolha a região mais próxima (ex: São Paulo/`sa-east-1` se disponível).
4. Aguarde alguns minutos até o projeto ficar pronto.

### 2. Rodar as migrations (schema, permissões, seed de referência)

1. No painel do Supabase, abra **SQL Editor** (menu lateral).
2. Clique em **New query**.
3. Abra cada arquivo da pasta [`supabase/migrations`](supabase/migrations) **nesta ordem** e cole o conteúdo, rodando um de cada vez (botão **Run**):
   1. `0001_schema.sql` — cria todas as tabelas
   2. `0002_rls.sql` — ativa Row Level Security e as políticas de permissão
   3. `0003_functions_triggers.sql` — cria os triggers de auditoria/notificação e o bucket de anexos
   4. `0004_seed_reference.sql` — popula áreas, categorias, tags e templates padrão

> Alternativa (linha de comando), se preferir usar a Supabase CLI:
> ```bash
> npx supabase login
> npx supabase link --project-ref <seu-project-ref>
> npx supabase db push
> ```

### 3. Pegar as chaves da API

1. No painel, vá em **Project Settings** (ícone de engrenagem) **→ API**.
2. Copie:
   - **Project URL** → vai virar `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → vai virar `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (em "Project API keys", clique para revelar) → vai virar `SUPABASE_SERVICE_ROLE_KEY`

⚠️ A **service_role key** dá acesso total ao banco, ignorando as permissões (RLS). **Nunca** coloque ela no frontend ou em um commit — ela só é usada em código de servidor (`scripts/seed-demo.ts` e nas Server Actions de `app/(app)/settings`).

### 4. Configurar as variáveis de ambiente

1. Copie o arquivo de exemplo:
   ```bash
   cp .env.example .env.local
   ```
2. Abra `.env.local` e cole os três valores que você copiou no passo 3.

### 5. Instalar dependências e rodar localmente

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) — você verá a tela de login.

### 6. Criar o primeiro usuário Master

Como ainda não existe nenhum usuário, você tem duas opções:

**Opção A — pelo painel do Supabase (mais simples):**
1. No Supabase, vá em **Authentication → Users → Add user → Create new user**.
2. Preencha e-mail e senha, marque **Auto Confirm User**.
3. Depois de criado, vá em **Table Editor → profiles**, encontre a linha criada automaticamente para esse usuário (o trigger `handle_new_user` cria o perfil sozinho) e edite a coluna `role` para `master`.

**Opção B — populando dados de demonstração (recomendado para começar a testar o sistema já com conteúdo):**
```bash
npm run seed
```
Isso cria 8 usuários fictícios (1 master, 1 gestor, 6 membros), 5 projetos, 4 campanhas e ~30 tarefas com checklists, tags e comentários, para você já ver o dashboard e os gráficos preenchidos. A senha de todos é `HelpMultas@2026` (definida em `scripts/seed-demo.ts`) — troque depois de testar.

Usuários criados pelo seed:
- `ana.costa@helpmultas.com` — Master
- `rafael.nogueira@helpmultas.com` — Gestor
- `camila.duarte@helpmultas.com`, `lucas.ferreira@helpmultas.com`, `juliana.prado@helpmultas.com`, `thiago.almeida@helpmultas.com`, `beatriz.lima@helpmultas.com`, `pedro.santos@helpmultas.com` — Membros

### 7. Login

Acesse `/login` com o e-mail e senha de um dos usuários acima (ou o Master que você criou na Opção A).

---

## Estrutura do projeto

```
src/
  app/(app)/          páginas protegidas (dashboard, tasks, board, calendar, ...)
  app/login/           tela de login pública
  components/ui/       primitivos do Design System (Button, Card, Badge, Dialog, ...)
  components/layout/   Sidebar, Topbar, NotificationDropdown, GlobalSearch
  components/tasks/    Kanban, TaskTable, TaskDetail, Checklist, Comments, Attachments
  components/dashboard/ StatCard, gráficos (recharts), ranking da equipe
  components/settings/ gestão de usuários, áreas/categorias, tags
  lib/services/        camada de acesso a dados (Supabase queries por domínio)
  lib/stats.ts          agregações usadas no dashboard e relatórios
  lib/supabase/         clients (browser, server, admin/service-role, proxy de sessão)
  types/database.ts     tipos das tabelas
supabase/migrations/    schema SQL, RLS, triggers, seed de referência
scripts/seed-demo.ts    script de dados de demonstração (usa a service role key)
```

## Notas e limitações conhecidas (para evoluir depois)

- **Fontes**: o Design System não trouxe arquivos de fonte da marca — está usando Poppins (títulos) + Nunito Sans (corpo) via Google Fonts como substituição, sinalizado no `readme.md` do Design System original.
- **Recorrência de tarefas**: o schema já suporta (`is_recurring`, `recurrence_freq`), mas a geração automática das próximas ocorrências ainda não roda sozinha (precisaria de um cron/Edge Function no Supabase) — hoje é um campo informativo na tarefa.
- **Relatórios**: exportação em CSV está pronta; PDF/Excel não foram implementados nesta primeira versão.
- **Integrações** (Meta Ads, Google Ads, Google Drive, WhatsApp): a arquitetura (áreas, campanhas, tarefas de tráfego pago) já comporta, mas nenhuma integração externa foi conectada.
- **Realtime**: o Supabase Realtime não está ligado ainda (notificações são atualizadas por polling a cada 30s); dá para trocar por subscriptions depois.
