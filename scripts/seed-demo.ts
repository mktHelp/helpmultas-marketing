/**
 * Seeds demo users, projects, campaigns and tasks for local/dev use.
 * Requires SUPABASE_SERVICE_ROLE_KEY (run migrations 0001-0004 first).
 *
 *   npm run seed
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO_PASSWORD = "HelpMultas@2026";

const USERS = [
  { email: "ana.costa@helpmultas.com", full_name: "Ana Beatriz Costa", role: "master", department: "Marketing", job_title: "Head de Marketing" },
  { email: "rafael.nogueira@helpmultas.com", full_name: "Rafael Nogueira", role: "gestor", department: "Marketing", job_title: "Gestor de Marketing" },
  { email: "camila.duarte@helpmultas.com", full_name: "Camila Duarte", role: "membro", department: "Social Media", job_title: "Social Media" },
  { email: "lucas.ferreira@helpmultas.com", full_name: "Lucas Ferreira", role: "membro", department: "Design", job_title: "Designer Gráfico" },
  { email: "juliana.prado@helpmultas.com", full_name: "Juliana Prado", role: "membro", department: "Vídeo", job_title: "Editora de Vídeo" },
  { email: "thiago.almeida@helpmultas.com", full_name: "Thiago Almeida", role: "membro", department: "Copywriting", job_title: "Redator" },
  { email: "beatriz.lima@helpmultas.com", full_name: "Beatriz Lima", role: "membro", department: "Tráfego Pago", job_title: "Analista de Tráfego Pago" },
  { email: "pedro.santos@helpmultas.com", full_name: "Pedro Henrique Santos", role: "membro", department: "Conteúdo", job_title: "Analista de Conteúdo" },
];

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function main() {
  console.log("Creating demo users...");
  const userIds: Record<string, string> = {};

  for (const u of USERS) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing.users.find((x) => x.email === u.email);
    if (found) {
      userIds[u.email] = found.id;
      console.log(`  - ${u.full_name} already exists, skipping`);
      continue;
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role, department: u.department, job_title: u.job_title },
    });
    if (error) throw error;
    userIds[u.email] = data.user!.id;
    console.log(`  - Created ${u.full_name} (${u.role})`);
  }

  const [ana, rafael, camila, lucas, juliana, thiago, beatriz, pedro] = USERS.map((u) => userIds[u.email]);

  const { data: areas } = await supabase.from("areas").select("id, name");
  const areaId = (name: string) => areas!.find((a) => a.name === name)!.id;

  console.log("Creating projects...");
  const projectsInput = [
    { name: "Helpcast", description: "Podcast institucional sobre trânsito e legislação", owner_id: rafael, status: "em_andamento", priority: "alta", progress: 60, end_date: daysFromNow(45) },
    { name: "Campanha Institucional", description: "Fortalecimento de marca Help Multas", owner_id: ana, status: "em_andamento", priority: "alta", progress: 40, end_date: daysFromNow(60) },
    { name: "Campanha de Franquias", description: "Captação de novos franqueados ABF", owner_id: rafael, status: "planejamento", priority: "media", progress: 15, end_date: daysFromNow(90) },
    { name: "Mês do Motorista", description: "Ações especiais de setembro", owner_id: camila, status: "em_andamento", priority: "urgente", progress: 70, end_date: daysFromNow(20) },
    { name: "Produção Social Media", description: "Calendário recorrente de redes sociais", owner_id: camila, status: "em_andamento", priority: "media", progress: 55, end_date: daysFromNow(120) },
  ];
  const { data: existingProjects } = await supabase.from("projects").select("id, name");
  const newProjects = projectsInput.filter((p) => !existingProjects?.some((e) => e.name === p.name));
  const { data: insertedProjects, error: pErr } = newProjects.length
    ? await supabase.from("projects").insert(newProjects).select()
    : { data: [], error: null };
  if (pErr) throw pErr;
  const projects = [...(existingProjects || []), ...(insertedProjects || [])];
  const projectId = (name: string) => projects.find((p) => p.name === name)!.id;

  console.log("Creating campaigns...");
  const campaignsInput = [
    { name: "Mês do Motorista", objective: "Aumentar recursos protocolados em 20%", owner_id: camila, budget: 45000, status: "ativa", start_date: daysFromNow(-10), end_date: daysFromNow(20) },
    { name: "ABF Franquias 2026", objective: "Captar 15 novos franqueados", owner_id: rafael, budget: 80000, status: "planejamento", start_date: daysFromNow(15), end_date: daysFromNow(90) },
    { name: "Black Friday Recursos", objective: "Promoção especial de análise gratuita", owner_id: ana, budget: 30000, status: "planejamento", start_date: daysFromNow(60), end_date: daysFromNow(75) },
    { name: "Lançamento Landing Page Nova", objective: "Aumentar conversão do site em 12%", owner_id: beatriz, budget: 12000, status: "ativa", start_date: daysFromNow(-20), end_date: daysFromNow(10) },
  ];
  const { data: existingCampaigns } = await supabase.from("campaigns").select("id, name");
  const newCampaigns = campaignsInput.filter((c) => !existingCampaigns?.some((e) => e.name === c.name));
  const { data: insertedCampaigns, error: cErr } = newCampaigns.length
    ? await supabase.from("campaigns").insert(newCampaigns).select()
    : { data: [], error: null };
  if (cErr) throw cErr;
  const campaigns = [...(existingCampaigns || []), ...(insertedCampaigns || [])];
  const campaignId = (name: string) => campaigns.find((c) => c.name === name)!.id;

  const { data: tags } = await supabase.from("tags").select("id, name");
  const tagId = (name: string) => tags!.find((t) => t.name === name)?.id;

  console.log("Creating tasks...");
  type TaskInput = {
    title: string; area: string; assigned_to: string | null; created_by: string;
    status: string; priority: string; due_date?: string; completed_at?: string;
    project?: string; campaign?: string; content_type?: string; description?: string;
  };

  const tasksInput: TaskInput[] = [
    { title: "Roteiro Reels — Suspensão da CNH", area: "Vídeo", assigned_to: juliana, created_by: rafael, status: "em_producao", priority: "alta", due_date: daysFromNow(2), project: "Mês do Motorista", content_type: "reels" },
    { title: "Editar episódio do Helpcast #12", area: "Vídeo", assigned_to: juliana, created_by: ana, status: "em_revisao", priority: "media", due_date: daysFromNow(4), project: "Helpcast", content_type: "youtube" },
    { title: "Criar criativos Meta Ads — Franquias", area: "Design", assigned_to: lucas, created_by: rafael, status: "em_producao", priority: "alta", due_date: daysFromNow(3), campaign: "ABF Franquias 2026", content_type: "anuncio" },
    { title: "Gravar conteúdo institucional", area: "Vídeo", assigned_to: juliana, created_by: ana, status: "planejamento", priority: "media", due_date: daysFromNow(10), project: "Campanha Institucional" },
    { title: "Revisar copy da campanha de franquias", area: "Copywriting", assigned_to: thiago, created_by: rafael, status: "em_revisao", priority: "alta", due_date: daysFromNow(1), campaign: "ABF Franquias 2026" },
    { title: "Subir campanha de tráfego — Mês do Motorista", area: "Tráfego Pago", assigned_to: beatriz, created_by: rafael, status: "aprovado", priority: "urgente", due_date: daysFromNow(-1), campaign: "Mês do Motorista" },
    { title: "Publicar carrossel Instagram — Direito de defesa", area: "Social Media", assigned_to: camila, created_by: camila, status: "publicado", priority: "media", due_date: daysFromNow(-3), completed_at: daysFromNow(-3), project: "Produção Social Media", content_type: "carrossel" },
    { title: "Escrever legenda Reels — Pontuação CNH", area: "Copywriting", assigned_to: thiago, created_by: camila, status: "concluido", priority: "baixa", due_date: daysFromNow(-5), completed_at: daysFromNow(-5), project: "Produção Social Media" },
    { title: "Landing page — nova campanha de tráfego", area: "Tráfego Pago", assigned_to: beatriz, created_by: ana, status: "em_producao", priority: "alta", due_date: daysFromNow(6), campaign: "Lançamento Landing Page Nova", content_type: "landing_page" },
    { title: "Briefing Black Friday Recursos", area: "Marketing", assigned_to: rafael, created_by: ana, status: "planejamento", priority: "media", due_date: daysFromNow(25), campaign: "Black Friday Recursos" },
    { title: "Gravar depoimento de cliente aprovado", area: "Vídeo", assigned_to: juliana, created_by: rafael, status: "backlog", priority: "media", due_date: daysFromNow(15), project: "Campanha Institucional" },
    { title: "Criar peça institucional — Dia do Motorista", area: "Design", assigned_to: lucas, created_by: camila, status: "aprovado", priority: "alta", due_date: daysFromNow(1), project: "Mês do Motorista" },
    { title: "E-mail marketing — recorrência de recurso", area: "Copywriting", assigned_to: thiago, created_by: rafael, status: "planejamento", priority: "baixa", due_date: daysFromNow(12), content_type: "email" },
    { title: "Stories — bastidores Helpcast", area: "Social Media", assigned_to: camila, created_by: camila, status: "em_producao", priority: "baixa", due_date: daysFromNow(2), project: "Helpcast", content_type: "stories" },
    { title: "Relatório semanal de tráfego pago", area: "Tráfego Pago", assigned_to: beatriz, created_by: rafael, status: "concluido", priority: "media", due_date: daysFromNow(-2), completed_at: daysFromNow(-2) },
    { title: "Planejamento editorial — próximo mês", area: "Conteúdo", assigned_to: pedro, created_by: rafael, status: "planejamento", priority: "media", due_date: daysFromNow(8) },
    { title: "Revisar peças aprovadas ABF", area: "Design", assigned_to: lucas, created_by: rafael, status: "em_revisao", priority: "alta", due_date: daysFromNow(-2), campaign: "ABF Franquias 2026" },
    { title: "Feed — infográfico prazos de recurso", area: "Design", assigned_to: lucas, created_by: pedro, status: "backlog", priority: "media", due_date: daysFromNow(9), content_type: "feed" },
    { title: "Blog — como recorrer de multa por excesso de velocidade", area: "Conteúdo", assigned_to: pedro, created_by: pedro, status: "em_producao", priority: "media", due_date: daysFromNow(7), content_type: "blog" },
    { title: "WhatsApp — lembrete de prazo de recurso", area: "Copywriting", assigned_to: thiago, created_by: camila, status: "backlog", priority: "baixa", due_date: daysFromNow(18), content_type: "whatsapp" },
    { title: "Gravação com Craque Neto", area: "Vídeo", assigned_to: juliana, created_by: ana, status: "planejamento", priority: "urgente", due_date: daysFromNow(5), project: "Campanha Institucional" },
    { title: "Análise de resultados — campanha franquias Q1", area: "Tráfego Pago", assigned_to: beatriz, created_by: rafael, status: "backlog", priority: "baixa", due_date: daysFromNow(30) },
    { title: "Feed — depoimento cliente Deferido", area: "Social Media", assigned_to: camila, created_by: camila, status: "publicado", priority: "media", due_date: daysFromNow(-7), completed_at: daysFromNow(-7), content_type: "feed" },
    { title: "Roteiro institucional — Sobre a Help Multas", area: "Vídeo", assigned_to: null, created_by: ana, status: "backlog", priority: "media", due_date: daysFromNow(20), project: "Campanha Institucional" },
    { title: "Ajustar landing page mobile", area: "Tráfego Pago", assigned_to: beatriz, created_by: beatriz, status: "em_revisao", priority: "alta", due_date: daysFromNow(-1), campaign: "Lançamento Landing Page Nova" },
    { title: "Reels — 3 mitos sobre suspensão da CNH", area: "Social Media", assigned_to: camila, created_by: rafael, status: "em_producao", priority: "alta", due_date: daysFromNow(3), content_type: "reels" },
    { title: "Copy anúncio Google Ads — franquias", area: "Copywriting", assigned_to: thiago, created_by: rafael, status: "aprovado", priority: "alta", due_date: daysFromNow(2), campaign: "ABF Franquias 2026" },
    { title: "Newsletter mensal — resultados de recursos", area: "Copywriting", assigned_to: thiago, created_by: pedro, status: "concluido", priority: "baixa", due_date: daysFromNow(-10), completed_at: daysFromNow(-9), content_type: "email" },
    { title: "Café com Cultura — pauta semanal", area: "Marketing", assigned_to: pedro, created_by: rafael, status: "backlog", priority: "baixa", due_date: daysFromNow(1) },
    { title: "TTT — reunião semanal de alinhamento", area: "Marketing", assigned_to: rafael, created_by: ana, status: "backlog", priority: "media", due_date: daysFromNow(2) },
  ];

  const { data: existingTasks } = await supabase.from("tasks").select("title");
  const newTasksInput = tasksInput.filter((t) => !existingTasks?.some((e) => e.title === t.title));

  if (!newTasksInput.length) {
    console.log("  - All demo tasks already exist, skipping");
    console.log("\nDone! Demo users (password for all: " + DEMO_PASSWORD + "):");
    USERS.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
    return;
  }

  const { data: tasks, error: tErr } = await supabase
    .from("tasks")
    .insert(
      newTasksInput.map((t) => ({
        title: t.title,
        description: t.description || null,
        area_id: areaId(t.area),
        assigned_to: t.assigned_to,
        created_by: t.created_by,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date || null,
        completed_at: t.completed_at || null,
        project_id: t.project ? projectId(t.project) : null,
        campaign_id: t.campaign ? campaignId(t.campaign) : null,
        content_type: t.content_type || null,
      }))
    )
    .select();
  if (tErr) throw tErr;

  console.log("Adding checklists, tags and comments...");
  const checklistTemplates = ["Definir ideia", "Criar roteiro", "Gravar", "Editar", "Revisar", "Publicar"];
  for (const [i, task] of tasks!.entries()) {
    if (i % 3 === 0) {
      const items = checklistTemplates.slice(0, 3 + (i % 4)).map((title, idx) => ({
        task_id: task.id,
        title,
        sort_order: idx,
        completed: task.status === "concluido" || task.status === "publicado" ? true : idx < 2,
      }));
      await supabase.from("task_checklists").insert(items);
    }

    if (i % 4 === 0) {
      const t = tagId(["urgente-cliente", "institucional", "franquias", "performance", "recorrente"][i % 5]);
      if (t) await supabase.from("task_tags").insert({ task_id: task.id, tag_id: t });
    }

    if (i % 5 === 0) {
      await supabase.from("task_comments").insert({
        task_id: task.id,
        user_id: task.created_by,
        content: "Pessoal, priorizar essa entrega — está no radar da diretoria.",
      });
    }
  }

  console.log("\nDone! Demo users (password for all: " + DEMO_PASSWORD + "):");
  USERS.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
