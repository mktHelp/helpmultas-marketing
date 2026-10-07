"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Plus, Save } from "lucide-react";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { MODELO_LABEL, brl, type DreInput, type DreResult } from "@/lib/expansion/dre";

/**
 * Confirmação de novo lead. Mostra o que está em andamento e deixa a escolha clara:
 * salvar antes de sair (recomendado) ou descartar o rascunho.
 */
export function NovoLead({
  open,
  onClose,
  S,
  c,
  jaSalva,
  salvando,
  erro,
  onSalvarENovo,
  onNovo,
}: {
  open: boolean;
  onClose: () => void;
  S: DreInput;
  c: DreResult;
  /** a simulação atual já foi salva e não mudou desde então */
  jaSalva: boolean;
  salvando: boolean;
  erro?: string;
  onSalvarENovo: () => void;
  onNovo: () => void;
}) {
  const nome = S.lead.trim();
  const podeSalvar = !!nome;
  return (
    <Dialog open={open} onClose={salvando ? () => {} : onClose} size="md">
      <DialogHeader title="Começar um novo lead?" subtitle="Você volta para a tela inicial para escolher o modelo." onClose={onClose} />
      <DialogBody className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-050 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Simulação em andamento</p>
          <p className="mt-1 font-display text-lg font-bold text-blue-900">{nome || "Lead sem nome"}</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
            {S.modelo && <span>Modelo <b className="text-blue-900">{MODELO_LABEL[S.modelo]}</b></span>}
            <span>Investimento <b className="text-blue-900">{brl(c.inv)}</b></span>
            <span>Retorno <b className="text-blue-900">{c.pay ? `mês ${c.pay}` : "> 36 meses"}</b></span>
          </div>
          <p className={cn("mt-3 flex items-center gap-1.5 text-xs font-semibold", jaSalva ? "text-[color:var(--color-success)]" : "text-amber-700")}>
            {jaSalva ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {jaSalva ? "Esta simulação já está salva no sistema." : "Esta simulação ainda não foi salva no sistema."}
          </p>
        </div>

        {!jaSalva && !podeSalvar && (
          <p className="rounded-xl bg-yellow-050 px-3.5 py-2.5 text-xs text-blue-900">Para salvar, informe o nome do lead na etapa <b>Mercado</b>. Sem nome, só dá para descartar.</p>
        )}
        {erro && <p className="rounded-xl bg-[color:var(--color-danger-bg)] px-3.5 py-2.5 text-xs font-semibold text-[color:var(--color-danger)]">{erro}</p>}

        <p className="text-xs leading-relaxed text-gray-500">
          {jaSalva
            ? "Você poderá abri-la depois em Opções → Simulações salvas."
            : "Se continuar sem salvar, o rascunho fica no navegador até você escolher um modelo; a partir daí ele é substituído e não dá para recuperar."}
        </p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        {jaSalva ? (
          <Button onClick={onNovo}><Plus className="h-4 w-4" /> Novo lead <ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <>
            <Button variant="danger" onClick={onNovo} disabled={salvando}>Descartar e começar novo</Button>
            <Button onClick={onSalvarENovo} disabled={!podeSalvar || salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar e começar novo
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
