// Diagnóstico puro (testável) — Fase 3 do projeto 2.
// Categoriza cada tentativa em padrões de erro a partir das métricas que os
// motores já registram, e agrega padrões globais para a página de Progresso.

import type { Attempt } from "@/lib/storage";

export type ErrorTag =
  "conteudo" | "fluencia" | "pronuncia" | "omissao" | "extra" | "falso-positivo" | "trap";

export interface TaggedAttempt {
  attempt: Attempt;
  /** Tags derivadas das métricas da tentativa. */
  tags: ErrorTag[];
}

/** Limiares do diagnóstico. */
export const LOW_SCORE = 70;
export const WPM_LOW = 100;
export const WPM_HIGH = 170;
export const OMISSION_RATIO = 0.2;
export const EXTRA_RATIO = 0.1;

/**
 * Deriva tags de uma tentativa a partir de `metrics`:
 * - conteudo: score de conteúdo baixo (<=70)
 * - fluencia: wpm fora da faixa 100–170
 * - pronuncia: alinhamento bom (hits >= 80% do total) mas score baixo
 * - omissao: palavras faltando >= 20% do total
 * - extra: palavras extras > 10% do total
 * - falso-positivo: marcas erradas em escolha múltipla / HIW
 * - trap: errou MCQ de escolha única (corte para cair em trap)
 */
export function tagAttempt(a: Attempt): TaggedAttempt {
  const tags: ErrorTag[] = [];
  const m = a.metrics as Record<string, number | undefined> | undefined;
  const score = a.score ?? a.contentScore;
  const hits = m?.["hits"];
  const missed = m?.["missed"];
  const extras = m?.["extras"];
  const total = m?.["total"] ?? m?.["answers"];
  const falsePositives = m?.["falsePositives"];

  if (typeof score === "number" && score <= LOW_SCORE) {
    tags.push("conteudo");
    // Pronúncia: a maior parte das palavras foi reconhecida, mas o score caiu.
    if (typeof hits === "number" && typeof total === "number" && total > 0 && hits / total >= 0.8) {
      tags.push("pronuncia");
    }
  }
  if (typeof a.wpm === "number" && a.wpm > 0 && (a.wpm < WPM_LOW || a.wpm > WPM_HIGH)) {
    tags.push("fluencia");
  }
  if (typeof hits === "number" && typeof missed === "number" && hits + missed > 0) {
    if (missed / (hits + missed) >= OMISSION_RATIO) tags.push("omissao");
  }
  if (
    typeof extras === "number" &&
    typeof total === "number" &&
    total > 0 &&
    extras / total > EXTRA_RATIO
  ) {
    tags.push("extra");
  }
  if (typeof falsePositives === "number" && falsePositives > 0) {
    tags.push("falso-positivo");
  }
  if (
    typeof score === "number" &&
    score <= LOW_SCORE &&
    (a.taskType === "mcq_single" || a.taskType === "lst_mcq")
  ) {
    tags.push("trap");
  }
  return { attempt: a, tags };
}

/**
 * Tags de fala (Read Aloud / Repeat Sentence / Retell Lecture) a partir do
 * alinhamento e do ritmo: conteúdo baixo, pronúncia (acerto alto mas score
 * baixo) e fluência (wpm fora da faixa).
 */
export function speakingTags(
  score: number,
  align: { hits: number; total: number },
  wpm: number | null,
): string[] {
  const tags: string[] = [];
  if (score <= LOW_SCORE) {
    tags.push("conteudo");
    if (align.total > 0 && align.hits / align.total >= 0.8) tags.push("pronuncia");
  }
  if (typeof wpm === "number" && wpm > 0 && (wpm < WPM_LOW || wpm > WPM_HIGH))
    tags.push("fluencia");
  return tags;
}

/** Rótulo legível de cada tag. */
export const TAG_LABELS: Record<ErrorTag, string> = {
  conteudo: "Conteúdo",
  fluencia: "Fluência",
  pronuncia: "Pronúncia",
  omissao: "Omissões",
  extra: "Extras",
  "falso-positivo": "Falsos positivos",
  trap: "Trap",
};

export interface DiagnosticSummary {
  /** Tentativas com ao menos uma tag de erro. */
  taggedCount: number;
  /** Total de tentativas consideradas. */
  totalCount: number;
  /** Quantidade por tag, ordenado (mais frequente primeiro). */
  tags: { tag: ErrorTag; count: number }[];
  /** Palavras mais faltadas (WFD/FIB), ordenado (top primeiro). */
  missedWords: { word: string; count: number }[];
  /** Questões com padrão recorrente (>= 2 tentativas erradas), piores primeiro. */
  problemQuestions: { qid: string; tags: ErrorTag[]; tries: number }[];
}

/**
 * Agrega tags de todas as tentativas. Tags por tentativa são também somadas
 * em `attempt.tags` (persistidas desde AppState v3) para o backup; aqui
 * recalculamos a partir das métricas para cobrir tentativas antigas.
 */
export function diagnoseAttempts(attempts: Attempt[]): DiagnosticSummary {
  const tagCount = new Map<ErrorTag, number>();
  const words = new Map<string, number>();
  const perQuestion = new Map<string, { tags: Map<ErrorTag, number>; tries: number }>();
  let taggedCount = 0;

  for (const a of attempts) {
    const { tags } = tagAttempt(a);
    for (const t of a.tags ?? []) {
      if (!t.startsWith("missed:") && !tags.includes(t as ErrorTag)) tags.push(t as ErrorTag);
    }
    if (tags.length > 0) taggedCount += 1;
    for (const t of tags) {
      tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      const cur = perQuestion.get(a.qid) ?? { tags: new Map<ErrorTag, number>(), tries: 0 };
      cur.tags.set(t, (cur.tags.get(t) ?? 0) + 1);
      perQuestion.set(a.qid, cur);
    }
    // Palavras faltadas: WFD usa marks (missed via gradeDictation persiste
    // contagem em metrics.missed; a lista vem de attempt.tags "missed:<word>").
    for (const t of a.tags ?? []) {
      if (t.startsWith("missed:")) {
        const w = t.slice("missed:".length);
        if (w) words.set(w, (words.get(w) ?? 0) + 1);
      }
    }
  }

  const problemQuestions = [...perQuestion.entries()]
    .filter(([, v]) => v.tries >= 2 || v.tags.size >= 1)
    .map(([qid, v]) => ({
      qid,
      tags: [...v.tags.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
      tries: v.tries,
    }))
    .sort((a, b) => b.tags.length - a.tags.length)
    .slice(0, 10);

  return {
    taggedCount,
    totalCount: attempts.length,
    tags: [...tagCount.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
    missedWords: [...words.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, 8),
    problemQuestions,
  };
}
