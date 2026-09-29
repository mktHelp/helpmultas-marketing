-- 0050_meta_sync_progress.sql — suporta o botão "Sincronizar agora" do
-- Hub: o job de sync passa a atualizar uma linha de progresso em texto
-- natural (ver progress_message) enquanto roda, e o front acompanha isso
-- via Realtime em vez de só ver o resultado final.

alter table meta_sync_runs add column progress_message text;

alter publication supabase_realtime add table meta_sync_runs;
