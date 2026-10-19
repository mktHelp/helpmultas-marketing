-- 0076_content_planning.sql — Planejamento de conteúdo (aba "Conteúdos"):
-- cronograma de posts por perfil do Instagram (ano, mês, semana e dia), com roteiro em blocos,
-- pendências ("[CONFIRMAR]") antes de gravar e Stories diários. Rode o 0075 antes.

create table if not exists content_plan_posts (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account in ('franchising', 'roberson')),
  publish_date date not null,
  format text not null default 'reels' check (format in ('reels', 'carrossel', 'feed')),
  pillar text,                         -- ex.: Mentalidade, Bastidores, Recurso de multa
  theme text not null,                 -- tema do post
  objective text,                      -- ex.: Atrair empreendedores, Confiança, Conversão
  funnel text check (funnel in ('topo', 'meio', 'fundo')),
  pinned_slot int check (pinned_slot between 1 and 3),   -- post fixado no perfil (01, 02, 03)
  trigger text,                        -- gatilho emocional
  duration text,                       -- ex.: "40 a 50 segundos" ou "9 slides"
  script_blocks jsonb not null default '[]'::jsonb,      -- [{label, timing, text}]
  recording_notes text,                -- gravação / design
  caption text,
  cta text,
  no_script boolean not null default false,              -- só acervo, sem roteiro
  pending jsonb not null default '[]'::jsonb,            -- [{text, done}] dados a confirmar antes de gravar
  status text not null default 'planejado' check (status in ('planejado', 'roteirizado', 'gravado', 'publicado')),
  task_id uuid references tasks(id) on delete set null,  -- tarefa de produção no quadro
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_content_plan_posts_date on content_plan_posts(publish_date, account);

create table if not exists content_plan_stories (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account in ('franchising', 'roberson')),
  story_date date not null,
  moment text not null default 'manha' check (moment in ('manha', 'durante', 'fim', 'extra')),
  text text not null default '',
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_content_plan_stories_date on content_plan_stories(story_date, account);

-- Resumo e regras de Stories do mês, por perfil.
create table if not exists content_plan_months (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account in ('franchising', 'roberson')),
  month date not null,                 -- sempre o dia 1
  summary text,
  story_rules text,
  updated_at timestamptz not null default now(),
  unique (account, month)
);

create or replace function public.touch_content_plan_posts()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_touch_content_plan_posts on content_plan_posts;
create trigger trg_touch_content_plan_posts before update on content_plan_posts
  for each row execute function public.touch_content_plan_posts();

alter table content_plan_posts enable row level security;
alter table content_plan_stories enable row level security;
alter table content_plan_months enable row level security;
drop policy if exists "content_plan_posts_all" on content_plan_posts;
create policy "content_plan_posts_all" on content_plan_posts for all using (public.is_internal_user()) with check (public.is_internal_user());
drop policy if exists "content_plan_stories_all" on content_plan_stories;
create policy "content_plan_stories_all" on content_plan_stories for all using (public.is_internal_user()) with check (public.is_internal_user());
drop policy if exists "content_plan_months_all" on content_plan_months;
create policy "content_plan_months_all" on content_plan_months for all using (public.is_internal_user()) with check (public.is_internal_user());

do $$
begin
  alter publication supabase_realtime add table content_plan_posts;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table content_plan_stories;
exception when duplicate_object then null;
end $$;

-- Seed: cronograma de outubro/2026 do @roberson.alvarenga (PDF do marketing). Só entra se o mês ainda estiver vazio.
insert into content_plan_posts (account, publish_date, format, pillar, theme, objective, funnel, pinned_slot, trigger, duration, script_blocks, recording_notes, caption, cta, no_script, pending, status)
select x.account, x.publish_date, x.format, x.pillar, x.theme, x.objective, x.funnel, x.pinned_slot, x.trigger, x.duration,
  coalesce(x.script_blocks, '[]'::jsonb), x.recording_notes, x.caption, x.cta, coalesce(x.no_script, false), coalesce(x.pending, '[]'::jsonb), x.status
from jsonb_to_recordset($seed$[{"account":"roberson","publish_date":"2026-10-17","format":"reels","pillar":"Pessoal + TBT","theme":"TBT Porsche Cup (só acervo, sem roteiro)","objective":"Aspiracional","funnel":"topo","no_script":true,"status":"roteirizado","recording_notes":"Sem roteiro: usar vídeos já gravados do acervo, com no máximo 15 segundos de corte.","caption":"Tem lugar que a gente chega porque trabalhou muito. E tem lugar que a gente vive para lembrar por que trabalha. [local/ano da Porsche Cup]","cta":"Qual foi o último lugar que te lembrou por que você trabalha?","pending":[{"text":"Confirmar local/ano da Porsche Cup para a legenda","done":false}]},{"account":"roberson","publish_date":"2026-10-19","format":"reels","pillar":"Mentalidade","theme":"Querer empreender x estar preparado","objective":"Atrair empreendedores","funnel":"topo","duration":"40 a 50 segundos","trigger":"Vaidade (quem se acha preparado) e preguiça (quem quer atalho)","script_blocks":[{"label":"Hook","timing":"0 a 3s","text":"Todo mundo quer ser dono. Quase ninguém quer ser preparado."},{"label":"Problema","timing":"3 a 15s","text":"Eu vejo muita gente querendo empreender porque cansou do chefe. Isso não é preparo, é cansaço. [CONFIRMAR: situação real em que o Rober sentiu isso no começo da Help]"},{"label":"Insight","timing":"15 a 35s","text":"Querer é o primeiro passo. Mas estar preparado é saber vender, aguentar o mês ruim e ter a família do seu lado. [CONFIRMAR: o que ele aprendeu sobre cada um desses três pontos]"},{"label":"Conclusão","timing":"35 a 45s","text":"Empreender não pede coragem de um dia. Pede preparo de todo dia."}],"cta":"Se você está pensando em empreender, o que te falta hoje: dinheiro, tempo ou coragem? Responde aqui.","pending":[{"text":"Situação real em que o Rober não estava preparado no início","done":false}],"status":"roteirizado"},{"account":"roberson","publish_date":"2026-10-20","format":"reels","pillar":"Bastidores","theme":"Uma decisão tomada hoje","objective":"Autoridade","funnel":"meio","duration":"45 a 60 segundos","trigger":"Inveja saudável (ver como um CEO decide) e curiosidade","script_blocks":[{"label":"Hook","timing":"0 a 3s","text":"Hoje eu tomei uma decisão que vai mexer com o futuro da Help."},{"label":"Contexto","timing":"3 a 20s","text":"[CONFIRMAR: qual foi a decisão, quem participou e qual era o problema]. Eu poderia ter feito o caminho fácil, que era [opção descartada]."},{"label":"Insight","timing":"20 a 45s","text":"Escolhi [decisão] porque [motivo real]. O resultado que a gente espera é [CONFIRMAR resultado esperado]."},{"label":"Conclusão","timing":"45 a 55s","text":"Decisão boa quase nunca parece boa na hora. Ela só parece depois."}],"recording_notes":"Cenas curtas da reunião ou da sede, com legenda explicando o que estava em jogo.","cta":"Você teria decidido o mesmo? Me conta nos comentários.","pending":[{"text":"Qual decisão real será explicada e o que ela pode mudar","done":false}],"status":"roteirizado"},{"account":"roberson","publish_date":"2026-10-22","format":"reels","pillar":"Estrutura Help","theme":"O que existe por trás da franquia","objective":"Confiança","funnel":"meio","pinned_slot":2,"duration":"50 a 60 segundos","trigger":"Ganância (o que eu ganho entrando) e medo de ficar sozinho (\"dou conta sozinho?\")","script_blocks":[{"label":"Hook","timing":"0 a 3s","text":"Franquia não é só uma marca. É tudo o que existe por trás dela."},{"label":"Desenvolvimento","timing":"3 a 40s","text":"Mostrar na tela, com o Rober andando pela sede ou apontando, cada item que existe de verdade: sistema próprio, CRM, supervisor comercial, treinamento e os 3 meses iniciais de gestão de tráfego pago pela franqueadora. Uma frase curta por item, sempre com imagem real da equipe ou do sistema."},{"label":"Insight","timing":"40 a 50s","text":"Quem compra uma franquia não compra só o nome. Compra a estrutura que trabalha enquanto você aprende."},{"label":"Conclusão","timing":"50 a 58s","text":"Ninguém precisa construir tudo sozinho. Eu construí a estrutura para você não precisar."}],"recording_notes":"Evidências concretas, não imagens bonitas do escritório. [CONFIRMAR: quais telas do sistema e quais pessoas da equipe podem aparecer]","cta":"Quer ver como isso funciona por dentro? Me chama no direct.","pending":[{"text":"Quais telas do sistema e quais pessoas da equipe podem aparecer","done":false}],"status":"roteirizado"},{"account":"roberson","publish_date":"2026-10-24","format":"carrossel","pillar":"História do Rober","theme":"Carrossel: da farda à Help (fixado 01) + TBT Porsche","objective":"Identificação","funnel":"topo","pinned_slot":1,"duration":"9 slides","trigger":"Inveja saudável e identificação com quem está preso na estabilidade","script_blocks":[{"label":"Slide 1 (capa)","timing":"","text":"Eu não comecei pensando em construir uma rede de franquias. Comecei buscando uma oportunidade de construir algo maior. Foto do Rober, com o nome e \"CEO da Help Multas\"."},{"label":"Slide 2 (antes)","timing":"","text":"Eu era [CONFIRMAR: como ele descreve a vida de policial militar]."},{"label":"Slide 3 (descoberta)","timing":"","text":"Fui estudar Direito e descobri um ramo que quase ninguém olha: o direito de trânsito."},{"label":"Slide 4 (virada)","timing":"","text":"Venci alguns casos e percebi que dava para viver disso. [CONFIRMAR: o caso marcante, como o do Sr. Adão, e o que ele sentiu]"},{"label":"Slide 5 (decisão)","timing":"","text":"Foi aí que eu larguei o serviço público para começar a Help. [CONFIRMAR: ano e o que a família achou]"},{"label":"Slide 6 (obstáculo)","timing":"","text":"[CONFIRMAR: o momento mais difícil depois de sair, com fatos reais. Não inventar dificuldade]"},{"label":"Slide 7 (hoje)","timing":"","text":"Hoje a Help é uma rede com [CONFIRMAR: número atual de unidades] unidades pelo Brasil."},{"label":"Slide 8 (aprendizado)","timing":"","text":"O que eu aprendi: [CONFIRMAR: o aprendizado principal]. Eu saí da estabilidade para construir algo meu, e construí de um jeito que outras pessoas também possam construir."},{"label":"Slide 9 (CTA)","timing":"","text":"Já pensou em sair da estabilidade? O que te segura? Me conta nos comentários. Fechar com \"Siga para acompanhar a construção\"."}],"recording_notes":"Usar a identidade visual do perfil pessoal, separada da franqueadora. Fotos reais de cada fase, sem banco de imagem. Fixar como o primeiro post do perfil. Uma ideia por slide, frases curtas e com fonética.","pending":[{"text":"Momento mais difícil depois de sair do serviço público, caso do Sr. Adão e número atual de unidades","done":false}],"status":"roteirizado"},{"account":"roberson","publish_date":"2026-10-26","format":"reels","pillar":"Mentalidade/vendas","theme":"O erro de vendas que me custou caro","objective":"Atrair","funnel":"topo","duration":"40 a 50 segundos","trigger":"Ira e medo de errar (\"vou conseguir vender?\")","script_blocks":[{"label":"Hook","timing":"0 a 3s","text":"Esse erro de vendas me custou caro, e eu demorei anos para perceber."},{"label":"História","timing":"3 a 20s","text":"[CONFIRMAR: o erro real, o que aconteceu e quanto custou, só com dados que o Rober autorizar]"},{"label":"Insight","timing":"20 a 38s","text":"Vendedor bom não é o que fala bem. É o que [CONFIRMAR: a lição]. Hoje eu faço diferente: [CONFIRMAR]. (A ideia \"vendedor bom não é o que fala bem\" é uma hipótese: só usar se o Rober concordar.)"},{"label":"Conclusão","timing":"38 a 45s","text":"Erro de venda não é o que você perde na hora. É o que você repete depois."}],"cta":"Você se identifica? Salva para lembrar disso na próxima reunião.","pending":[{"text":"Qual erro de vendas ou gestão será contado e se a ideia \"vendedor bom não é o que fala bem\" faz sentido para ele","done":false}],"status":"roteirizado"},{"account":"roberson","publish_date":"2026-10-27","format":"reels","pillar":"Lifestyle com propósito","theme":"O que eu valorizo hoje","objective":"Desejo","funnel":"topo","duration":"35 a 45 segundos","trigger":"Vaidade e luxúria de vida (desejo de ter uma vida boa), sem ostentação e sem sugerir que empreender é trabalhar pouco","script_blocks":[{"label":"Hook","timing":"0 a 3s","text":"Tem uma coisa que eu valorizo hoje e que eu não valorizava quando comecei a empreender."},{"label":"Desenvolvimento","timing":"3 a 28s","text":"[CONFIRMAR: o valor real, por exemplo tempo com a família, treino ou rotina]. Quando eu comecei, eu achava que [CONFIRMAR]. Hoje eu organizo minha semana de outro jeito: [CONFIRMAR]. Imagens de rotina real: treino, família, viagem, tênis."},{"label":"Insight","timing":"28 a 38s","text":"Construir um negócio dá trabalho. A diferença é que, com o tempo, você escolhe melhor onde colocar sua energia."},{"label":"Conclusão","timing":"","text":"Sucesso não é ter mais tempo livre. É decidir para quem sobra o tempo."}],"cta":"E você, o que valoriza hoje que não valorizava antes?","pending":[{"text":"Qual valor pessoal ele quer destacar","done":false}],"status":"roteirizado"},{"account":"roberson","publish_date":"2026-10-29","format":"reels","pillar":"Histórias da rede","theme":"Jornada de um franqueado","objective":"Prova social","funnel":"meio","duration":"60 a 75 segundos","trigger":"Inveja saudável e identificação (\"se ele conseguiu, eu também posso\")","script_blocks":[{"label":"Hook","timing":"0 a 4s","text":"[Nome], de [cidade], era [profissão anterior]. Hoje ele toca uma unidade da Help."},{"label":"Antes","timing":"4 a 20s","text":"Quem era, qual problema tinha e por que decidiu empreender. [CONFIRMAR com o franqueado]"},{"label":"Decisão","timing":"20 a 35s","text":"Por que escolheu a Help e o que a família achou. [CONFIRMAR com o franqueado]"},{"label":"Desafio","timing":"35 a 50s","text":"O que foi difícil nos primeiros meses e como superou."},{"label":"Resultado","timing":"50 a 65s","text":"O que mudou na rotina. Só citar faturamento ou números se forem reais, contextualizados e autorizados por escrito."},{"label":"Conclusão e CTA","timing":"","text":"A história da Help não termina em mim. Se você quer ser o próximo case, me chama no direct."}],"recording_notes":"Depoimento em vídeo do franqueado, com nome e cidade na tela. [CONFIRMAR qual franqueado e se há autorização de imagem e de resultados]","pending":[{"text":"Qual franqueado será o case e a autorização de imagem e de resultados","done":false}],"status":"roteirizado"},{"account":"roberson","publish_date":"2026-10-31","format":"reels","pillar":"Oportunidade Help","theme":"Como fazer parte dessa história","objective":"Conversão","funnel":"fundo","pinned_slot":3,"duration":"50 a 60 segundos","trigger":"Ganância e preguiça (como começar sem criar tudo do zero), com um filtro claro: dedicação 100%. É o único post de conversão direta do mês.","script_blocks":[{"label":"Hook","timing":"0 a 4s","text":"Você não precisa criar um negócio do zero para começar a empreender. Mas precisa escolher um modelo que faça sentido para você."},{"label":"O modelo","timing":"4 a 25s","text":"A Help é um negócio de serviço, sem estoque, que o franqueado opera de casa [CONFIRMAR valores vigentes de investimento, custo mensal e prazo de retorno antes de citar, sempre em faixas e sem promessa de ganho]."},{"label":"Para quem é","timing":"25 a 42s","text":"Funciona para quem tem experiência com venda ou atendimento, se dedica 100% e envolve a família na decisão."},{"label":"Como conhecer","timing":"42 a 55s","text":"O primeiro passo é uma conversa com a nossa equipe de expansão. Sem compromisso e sem pressa."}],"recording_notes":"Olhando para a câmera. Depois de publicado, fixar no perfil.","cta":"Se você está pensando em empreender, me chama no direct ou clica no link da bio.","pending":[{"text":"Valores vigentes de investimento, custo mensal e prazo de retorno, para citar em faixas e sem promessa de ganho","done":false}],"status":"roteirizado"}]$seed$::jsonb) as x(
  account text, publish_date date, format text, pillar text, theme text, objective text, funnel text, pinned_slot int, trigger text, duration text,
  script_blocks jsonb, recording_notes text, caption text, cta text, no_script boolean, pending jsonb, status text)
where not exists (select 1 from content_plan_posts where account = 'roberson' and publish_date between '2026-10-01' and '2026-10-31');

insert into content_plan_months (account, month, summary, story_rules)
values ('roberson', '2026-10-01', $s$São 9 posts (8 Reels e 1 carrossel) em quatro dias fixos por semana (segunda, terça, quinta e sábado), com Stories todos os dias. Só 1 post é de conversão direta (31/10), e os três posts fixados do perfil entram nos dias 22, 24 e 31.$s$, $s$A oportunidade Help aparece em no máximo 1 ou 2 dias por semana (sugestão: quinta e sábado).
Não usar mais Stories com imagem de fundo e texto do tipo "confira o conteúdo de hoje". Se for Story de divulgação, usar uma frase de impacto ou uma imagem que traga autoridade.
O que deve aparecer no repost para outro perfil precisa estar nos primeiros 15 a 20 segundos.
Cerca de 80% das pessoas assistem só 10 a 20 segundos, então o começo é a capa da revista.
Story de 1 minuto com dois pontos fortes pode virar dois de 30 segundos.
Dias de Reel de lifestyle (27/10) e fins de semana: reforçar com Stories de família, treino ou rotina, em menor quantidade, só para mostrar proximidade.
Uma caixinha de perguntas sobre liderança e empreendedorismo por semana (sugestão: terça), para alimentar os Reels seguintes.$s$)
on conflict (account, month) do nothing;
