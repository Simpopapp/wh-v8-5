// Simulado PTE (modo exame) — plano de blocos, fila estratificada, tempos por
// questão e resumo comparativo. Puro e testável (sem React, sem localStorage).

import { getMeta, metaByType } from "./manifest";
import { SECTION_META, SECTION_ORDER, TYPE_META, type Section, type TaskType } from "./types";
import { skillsFor, type Skill } from "./skillMatrix";

export type ExamId = Section | "full" | "mini";

export interface ExamBlock {
  taskType: TaskType;
  count: number;
  /** Tempo oficial aproximado por questão (s). */
  seconds: number;
}

/** Tempo oficial aproximado por questão (s), por task type. */
export const EXAM_SECONDS: Record<TaskType, number> = {
  read_aloud: 40,
  repeat_sentence: 15,
  retell_lecture: 50, // 10s de preparação + 40s de fala
  answer_short: 10,
  swt: 600,
  write_essay: 1200, // 20 min
  mcq_single: 120,
  mcq_multi: 150,
  reorder_paragraphs: 180,
  read_fib: 120,
  wfd: 25,
  lst_fib: 90,
  summarize_spoken_text: 600,
  lst_hiw: 120,
  lst_hcs: 120,
  lst_summary: 600,
  lst_smw: 120,
  lst_mcq: 120,
  lst_mcq_multi: 150,
  // Fase 7: tempos oficiais — SGD 10 s prep + 2 min fala; RTS 10 s + 40 s;
  // DI 25 s de estudo + 40 s de fala.
  summarize_group_discussion: 130,
  respond_to_situation: 50,
  describe_image: 65,
};

/** Cronômetro de uma questão do simulado (s). */
export function examTiming(taskType: TaskType): number {
  return EXAM_SECONDS[taskType];
}

const SECTION_PLANS: Record<Section, ExamBlock[]> = {
  speaking: [
    { taskType: "read_aloud", count: 2, seconds: EXAM_SECONDS.read_aloud },
    { taskType: "repeat_sentence", count: 3, seconds: EXAM_SECONDS.repeat_sentence },
    { taskType: "describe_image", count: 1, seconds: EXAM_SECONDS.describe_image },
    { taskType: "retell_lecture", count: 1, seconds: EXAM_SECONDS.retell_lecture },
    { taskType: "respond_to_situation", count: 1, seconds: EXAM_SECONDS.respond_to_situation },
    {
      taskType: "summarize_group_discussion",
      count: 1,
      seconds: EXAM_SECONDS.summarize_group_discussion,
    },
    { taskType: "answer_short", count: 2, seconds: EXAM_SECONDS.answer_short },
  ],
  writing: [
    { taskType: "swt", count: 2, seconds: EXAM_SECONDS.swt },
    { taskType: "write_essay", count: 1, seconds: EXAM_SECONDS.write_essay },
  ],
  reading: [
    { taskType: "mcq_single", count: 2, seconds: EXAM_SECONDS.mcq_single },
    { taskType: "mcq_multi", count: 1, seconds: EXAM_SECONDS.mcq_multi },
    { taskType: "reorder_paragraphs", count: 2, seconds: EXAM_SECONDS.reorder_paragraphs },
    { taskType: "read_fib", count: 2, seconds: EXAM_SECONDS.read_fib },
  ],
  listening: [
    { taskType: "wfd", count: 3, seconds: EXAM_SECONDS.wfd },
    { taskType: "lst_fib", count: 2, seconds: EXAM_SECONDS.lst_fib },
    { taskType: "summarize_spoken_text", count: 1, seconds: EXAM_SECONDS.summarize_spoken_text },
    { taskType: "lst_hiw", count: 1, seconds: EXAM_SECONDS.lst_hiw },
    { taskType: "lst_hcs", count: 1, seconds: EXAM_SECONDS.lst_hcs },
    { taskType: "lst_summary", count: 1, seconds: EXAM_SECONDS.lst_summary },
    { taskType: "lst_smw", count: 1, seconds: EXAM_SECONDS.lst_smw },
    { taskType: "lst_mcq", count: 1, seconds: EXAM_SECONDS.lst_mcq },
    { taskType: "lst_mcq_multi", count: 1, seconds: EXAM_SECONDS.lst_mcq_multi },
  ],
};

/**
 * Blueprint oficial (Fase 8 — D15): contagens e ordem do exame real (~2 h),
 * conforme o formato Pearson vigente confirmado na Fase 0. Onde o oficial dá um
 * intervalo (ex.: Read Aloud 6–7), usa-se o meio/valor conservador — a fila
 * respeita o estoque do banco via `Math.min`.
 * Ordem fixa: Speaking & Writing → Reading → Listening.
 */
const BLUEPRINT: ExamBlock[] = [
  // Speaking & Writing (76–84 min oficiais, sem Personal Introduction — não pontuada)
  { taskType: "read_aloud", count: 6, seconds: EXAM_SECONDS.read_aloud },
  { taskType: "repeat_sentence", count: 11, seconds: EXAM_SECONDS.repeat_sentence },
  { taskType: "describe_image", count: 3, seconds: EXAM_SECONDS.describe_image },
  { taskType: "retell_lecture", count: 2, seconds: EXAM_SECONDS.retell_lecture },
  { taskType: "answer_short", count: 5, seconds: EXAM_SECONDS.answer_short },
  {
    taskType: "summarize_group_discussion",
    count: 1,
    seconds: EXAM_SECONDS.summarize_group_discussion,
  },
  { taskType: "respond_to_situation", count: 2, seconds: EXAM_SECONDS.respond_to_situation },
  { taskType: "swt", count: 2, seconds: EXAM_SECONDS.swt },
  { taskType: "write_essay", count: 1, seconds: EXAM_SECONDS.write_essay },
  // Reading (23–30 min oficiais)
  { taskType: "read_fib", count: 5, seconds: EXAM_SECONDS.read_fib },
  { taskType: "mcq_multi", count: 2, seconds: EXAM_SECONDS.mcq_multi },
  { taskType: "reorder_paragraphs", count: 2, seconds: EXAM_SECONDS.reorder_paragraphs },
  { taskType: "mcq_single", count: 2, seconds: EXAM_SECONDS.mcq_single },
  // Listening (31–39 min oficiais)
  { taskType: "summarize_spoken_text", count: 2, seconds: EXAM_SECONDS.summarize_spoken_text },
  { taskType: "lst_mcq_multi", count: 2, seconds: EXAM_SECONDS.lst_mcq_multi },
  { taskType: "lst_fib", count: 2, seconds: EXAM_SECONDS.lst_fib },
  { taskType: "lst_hcs", count: 1, seconds: EXAM_SECONDS.lst_hcs },
  { taskType: "lst_mcq", count: 1, seconds: EXAM_SECONDS.lst_mcq },
  { taskType: "lst_smw", count: 1, seconds: EXAM_SECONDS.lst_smw },
  { taskType: "lst_hiw", count: 2, seconds: EXAM_SECONDS.lst_hiw },
  { taskType: "wfd", count: 4, seconds: EXAM_SECONDS.wfd },
];

/**
 * Tarefas oficiais pontuadas que o blueprint omite, com o motivo explícito
 * (Fase 8/D15: "este simulado omite X por banco indisponível").
 */
export const BLUEPRINT_OMISSIONS: string[] = [
  "Fill in the Blanks (drag & drop) — o catálogo só tem o FIB dropdown de Reading",
];

/**
 * Plano do simulado: seções usam o plano encurtado (mini); `mini` é o
 * simulado encurtado integral (o antigo "completo"); `full` é o blueprint
 * oficial de ~2 h.
 */
export const EXAM_PLAN: Record<ExamId, ExamBlock[]> = {
  ...SECTION_PLANS,
  mini: SECTION_ORDER.flatMap((s) => SECTION_PLANS[s]!),
  full: BLUEPRINT,
};

export function examLabel(examId: ExamId): string {
  if (examId === "full") return "Simulado completo";
  if (examId === "mini") return "Mini-simulado";
  return `Simulado ${SECTION_META[examId]!.label}`;
}

/**
 * Blocos com a fila ELEGÍVEL real (projeto 13, §1.5): mesmo filtro do
 * `buildExamQueue` (sem quase-duplicatas; com `verifiedOnly`, só fontes
 * verificadas) — a estimativa do menu nunca promete o que a fila não tem.
 */
export function eligibleExamBlocks(
  examId: ExamId,
  opts: { verifiedOnly?: boolean } = {},
): ExamBlock[] {
  const out: ExamBlock[] = [];
  for (const block of EXAM_PLAN[examId]!) {
    const eligible = metaByType(block.taskType).filter(
      (m) => !m.duplicate && (!opts.verifiedOnly || m.sourceClass === "verificada"),
    );
    const take = Math.min(block.count, eligible.length);
    if (take > 0) out.push({ ...block, count: take });
  }
  return out;
}

/** Tempo total estimado do simulado (s) — pela fila elegível real. */
export function estimateSeconds(examId: ExamId, opts: { verifiedOnly?: boolean } = {}): number {
  return eligibleExamBlocks(examId, opts).reduce((sum, b) => sum + b.count * b.seconds, 0);
}

/** Quantas questões o simulado tem — pela fila elegível real. */
export function examQuestionCount(examId: ExamId, opts: { verifiedOnly?: boolean } = {}): number {
  return eligibleExamBlocks(examId, opts).reduce((sum, b) => sum + b.count, 0);
}

type Rand = () => number;

function shuffle<T>(list: T[], rand: Rand): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}

/** Fila do simulado: amostra estratificada por bloco (respeita o estoque de cada tipo). */
export function buildExamQueue(
  examId: ExamId,
  rand: Rand = Math.random,
  opts: { verifiedOnly?: boolean } = {},
): string[] {
  const out: string[] = [];
  for (const block of eligibleExamBlocks(examId, opts)) {
    const base = metaByType(block.taskType).filter(
      (m) => !m.duplicate && (!opts.verifiedOnly || m.sourceClass === "verificada"),
    );
    out.push(
      ...shuffle(base, rand)
        .slice(0, block.count)
        .map((m) => m.id),
    );
  }
  return out;
}

// ---------- Resumo comparativo ----------

/**
 * Causa do resultado de uma questão do simulado (projeto 13, §1.5): score
 * null nunca é um "0 disfarçado" — o motivo fica rotulado.
 */
export type ExamResultCause =
  | "graded" // avaliada normalmente
  | "skipped" // pulada pelo usuário
  | "expired" // tempo esgotado sem resposta (inclusive fora do app)
  | "technical" // falha técnica (permissão/rede/sem ASR)
  | "empty" // nada reconhecido
  | "not_gradable"; // transcrição insuficiente para avaliação justa

export interface ExamResultRow {
  qid: string;
  score: number | null;
  /** Motivo do estado da questão (ausente = legado: tratado como avaliada/pulada). */
  cause?: ExamResultCause;
  /** Resposta enviada (resumo), para a revisão pós-exame. */
  answer?: string;
}

/** Tentativa histórica de prática (para comparar com o simulado). */
export interface HistoryAttempt {
  taskType: TaskType;
  score: number | null;
  tags?: string[];
}

export interface ExamTypeSummary {
  taskType: TaskType;
  label: string;
  section: Section;
  avg: number | null;
  n: number;
  /** Média histórica de prática (sem exames) — null se nunca treinou. */
  practiceAvg: number | null;
}

/** Fase 8 (C5): média por habilidade no simulado, comparada à prática livre. */
export interface ExamSkillSummary {
  skill: Skill;
  label: string;
  /** Média no simulado, agregando as tarefas que pontuam a habilidade. */
  avg: number | null;
  /** Média histórica de prática na habilidade (sem exames). */
  practiceAvg: number | null;
}

export interface ExamSummary {
  gradedCount: number;
  totalCount: number;
  /** Questões SEM score — dimensão central do resumo (nunca viram 0). */
  notEvaluated: number;
  /** Breakdown do motivo: pulada / expirada / técnica / vazia / não avaliável. */
  notEvaluatedByCause: Partial<Record<ExamResultCause, number>>;
  overall: number | null;
  bySection: { section: Section; label: string; avg: number | null; n: number }[];
  byType: ExamTypeSummary[];
  /** Média por habilidade (matriz oficial), comparada à prática livre. */
  bySkill: ExamSkillSummary[];
  /** Tipos com média < 70 (mais fracos primeiro). */
  weakest: ExamTypeSummary[];
}

/**
 * Resume um simulado: média geral, por seção e por tipo, comparando com a média
 * histórica de prática (tentativas sem a tag "exam").
 */
export function gradeExamSummary(
  results: ExamResultRow[],
  history: HistoryAttempt[] = [],
): ExamSummary {
  const groups = new Map<TaskType, { sum: number; n: number }>();
  for (const r of results) {
    if (r.score === null) continue;
    const m = getMeta(r.qid);
    if (!m) continue;
    const g = groups.get(m.taskType) ?? { sum: 0, n: 0 };
    g.sum += r.score;
    g.n += 1;
    groups.set(m.taskType, g);
  }

  const practice = new Map<TaskType, { sum: number; n: number }>();
  for (const a of history) {
    if (a.score === null || a.tags?.includes("exam")) continue;
    const p = practice.get(a.taskType) ?? { sum: 0, n: 0 };
    p.sum += a.score;
    p.n += 1;
    practice.set(a.taskType, p);
  }

  const avgOf = (g?: { sum: number; n: number }) => (g && g.n > 0 ? Math.round(g.sum / g.n) : null);

  const byType: ExamTypeSummary[] = [...groups.entries()]
    .map(([taskType, g]) => ({
      taskType,
      label: TYPE_META[taskType]!.label,
      section: TYPE_META[taskType]!.section,
      avg: Math.round(g.sum / g.n),
      n: g.n,
      practiceAvg: avgOf(practice.get(taskType)),
    }))
    .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0));

  const bySection = SECTION_ORDER.map((section) => {
    const rows = byType.filter((t) => t.section === section);
    const n = rows.reduce((s, t) => s + t.n, 0);
    const weighted = rows.reduce((s, t) => s + (t.avg ?? 0) * t.n, 0);
    return {
      section,
      label: SECTION_META[section]!.label,
      avg: n > 0 ? Math.round(weighted / n) : null,
      n,
    };
  });

  const graded = results.filter((r) => r.score !== null);
  const overall = graded.length
    ? Math.round(graded.reduce((s, r) => s + (r.score ?? 0), 0) / graded.length)
    : null;

  // Fase 8: média por habilidade — cada resultado contribui para todas as
  // habilidades da matriz oficial (TASK_SKILLS), igualmente à prática.
  const skillNames: Skill[] = ["speaking", "writing", "reading", "listening"];
  const examBySkill = new Map<Skill, { sum: number; n: number }>();
  for (const r of results) {
    if (r.score === null) continue;
    const m = getMeta(r.qid);
    if (!m) continue;
    for (const skill of skillsFor(m.taskType)) {
      const g = examBySkill.get(skill) ?? { sum: 0, n: 0 };
      g.sum += r.score;
      g.n += 1;
      examBySkill.set(skill, g);
    }
  }
  const practiceBySkill = new Map<Skill, { sum: number; n: number }>();
  for (const a of history) {
    if (a.score === null || a.tags?.includes("exam")) continue;
    for (const skill of skillsFor(a.taskType)) {
      const p = practiceBySkill.get(skill) ?? { sum: 0, n: 0 };
      p.sum += a.score;
      p.n += 1;
      practiceBySkill.set(skill, p);
    }
  }
  const bySkill: ExamSkillSummary[] = skillNames.map((skill) => ({
    skill,
    label: SECTION_META[skill]!.label,
    avg: avgOf(examBySkill.get(skill)),
    practiceAvg: avgOf(practiceBySkill.get(skill)),
  }));

  const notEvaluatedByCause: Partial<Record<ExamResultCause, number>> = {};
  for (const r of results) {
    if (r.score !== null) continue;
    const c: ExamResultCause = r.cause ?? "skipped";
    notEvaluatedByCause[c] = (notEvaluatedByCause[c] ?? 0) + 1;
  }

  return {
    gradedCount: graded.length,
    totalCount: results.length,
    notEvaluated: results.length - graded.length,
    notEvaluatedByCause,
    overall,
    bySection,
    byType,
    bySkill,
    weakest: byType.filter((t) => (t.avg ?? 0) < 70).slice(0, 4),
  };
}

/** Qids que valem revisão pós-exame: não avaliadas e notas abaixo de 70. */
export function examReviewQids(results: ExamResultRow[]): string[] {
  return results.filter((r) => r.score === null || r.score < 70).map((r) => r.qid);
}
