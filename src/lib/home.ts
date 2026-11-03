/**
 * Modelo da Home (projeto 13, §4.4.2 / S5): 1ª visita vs retorno, prioridade de
 * retomada e ação do plano do dia — funções puras, sem escrita no store.
 *
 * "Retorno" = atividade de estudo persistida (não contador de visitas).
 * Prioridade de retomada: sessão em andamento → simulado (running) → revisão de
 * vocabulário salva → vocabulário vencido → última questão respondida.
 */
import { flattenVocab, vocabCounts, vocabDueCount, type VocabKind } from "@/lib/plus/vocab";
import { getMeta, TYPE_META, type TaskType } from "@/lib/pte";
import { buildDailyPlan, type PlanCounts } from "@/lib/pte/studyPlan";
import { estimateSessionSeconds, previewMixedQueue } from "@/lib/session";
import { computeStats, type AppState } from "@/lib/storage";

export type HomeResume =
  | { kind: "session"; qid: string | null; label: string; remaining: number }
  | { kind: "exam"; label: string; remaining: number }
  | { kind: "vocabDraft"; remaining: number }
  | { kind: "vocabDue"; count: number }
  | { kind: "question"; qid: string; label: string; topic: string };

/** Houve atividade de estudo? (ajustes/notas/favoritos não contam) */
export function hasStudyActivity(app: AppState): boolean {
  if (app.draft && app.draft.kind !== "exam") return true;
  if (app.examDraft?.phase === "running") return true;
  if (app.vocabDraft) return true;
  if (app.attempts.length > 0) return true;
  if (app.sessions.length > 0) return true;
  if (Object.values(app.daily).some((d) => d.attempts > 0)) return true;
  return vocabCounts(app.vocabulary).total > 0;
}

/** Rótulo humano da retomada (consumido pelo hero de retorno). */
export function resumeLabel(resume: HomeResume): string {
  switch (resume.kind) {
    case "session":
      return "Retomar sessão";
    case "exam":
      return "Retomar simulado";
    case "vocabDraft":
      return "Continuar revisão de vocabulário";
    case "vocabDue":
      return "Revisar vocabulário";
    case "question":
      return "Repetir última questão";
  }
}

/** Revisão de vocabulária retomável: cartões restantes existentes após o clamp. */
function vocabDraftRemaining(app: AppState): number {
  const draft = app.vocabDraft;
  if (!draft) return 0;
  const byKey = new Set(flattenVocab(app.vocabulary).map((it) => `${it.kind}:${it.key}`));
  const idx = Math.min(draft.index, draft.queue.length);
  let remaining = 0;
  for (let i = idx; i < draft.queue.length; i++) {
    const c = draft.queue[i];
    if (c && byKey.has(`${c.kind as VocabKind}:${c.key}`)) remaining += 1;
  }
  // cartões já exibidos mas ainda na fila (reagendados) contam como pendentes
  // apenas se à frente do índice — comportamento igual à rota de vocabulário.
  return remaining;
}

/** Prioridade de retomada (§4.4.2). Nunca inventa tarefa: só o que existe. */
export function selectHomeResume(app: AppState, now: number): HomeResume | null {
  // 1. Sessão em andamento (não exame).
  if (app.draft && app.draft.kind !== "exam") {
    const d = app.draft;
    const qid = d.queue[Math.min(d.index, Math.max(d.queue.length - 1, 0))] ?? null;
    return {
      kind: "session",
      qid: qid && getMeta(qid) ? qid : null,
      label: d.label,
      remaining: Math.max(0, d.queue.length - d.index),
    };
  }
  // 2. Simulado em execução (summary não disputa retomada).
  if (app.examDraft?.phase === "running" && app.examDraft.index < app.examDraft.queue.length) {
    return {
      kind: "exam",
      label: examLabel(app.examDraft.examId),
      remaining: app.examDraft.queue.length - app.examDraft.index,
    };
  }
  // 3. Revisão de vocabulário salva com cartões restantes reais.
  const vocabLeft = vocabDraftRemaining(app);
  if (app.vocabDraft && vocabLeft > 0) return { kind: "vocabDraft", remaining: vocabLeft };
  // 4. Vocabulário vencido, sem revisão em andamento.
  const due = vocabDueCount(app.vocabulary, now);
  if (due > 0) return { kind: "vocabDue", count: due };
  // 5. Última questão respondida ainda existente.
  const sorted = [...app.attempts].sort((a, b) => b.ts - a.ts);
  for (const a of sorted) {
    const meta = getMeta(a.qid);
    if (meta) {
      return {
        kind: "question",
        qid: a.qid,
        label: TYPE_META[meta.taskType].label,
        topic: meta.topic,
      };
    }
  }
  return null;
}

function examLabel(examId: string): string {
  if (examId === "mini") return "Mini-simulado";
  if (examId === "full") return "Simulado completo";
  const meta = getMeta(examId);
  return meta ? TYPE_META[meta.taskType].label : "Simulado";
}

/** Ação do plano de hoje (§4.4.2): quantidade e duração da fila efetiva. */
export interface HomeDailyAction {
  counts: PlanCounts;
  dueCounts: PlanCounts;
  newCounts: PlanCounts;
  count: number;
  reviews: number;
  seconds: number;
  types: { type: TaskType; label: string; count: number }[];
}

export function buildHomeDailyAction(app: AppState, now = Date.now()): HomeDailyAction | null {
  const stats = computeStats(app);
  const plan = buildDailyPlan(app, stats, now);
  if (plan.total <= 0) return null;
  const preview = previewMixedQueue(plan.counts, stats, app.settings.verifiedOnly, {
    due: plan.dueCounts,
    fresh: plan.newCounts,
  });
  if (preview.ids.length === 0) return null;
  const sumDue = (Object.values(plan.dueCounts) as number[]).reduce((a, b) => a + (b ?? 0), 0);
  const byType = new Map<TaskType, number>();
  for (const qid of preview.ids) {
    const meta = getMeta(qid);
    if (!meta) continue;
    byType.set(meta.taskType, (byType.get(meta.taskType) ?? 0) + 1);
  }
  const types = [...byType.entries()].map(([type, count]) => ({
    type,
    label: TYPE_META[type].label,
    count,
  }));
  return {
    counts: plan.counts,
    dueCounts: plan.dueCounts,
    newCounts: plan.newCounts,
    count: preview.ids.length,
    reviews: Math.max(0, sumDue - preview.dueShort),
    seconds: estimateSessionSeconds(preview.ids),
    types,
  };
}
