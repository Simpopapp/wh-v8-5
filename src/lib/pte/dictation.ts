// Correção pura (testável) para os motores de Listening — Fase 2: WFD, FIB e HIW.

import { normalizeWord } from "@/lib/scoring";

import { tokenize } from "./types";

// ---------- WFD (Write From Dictation) ----------

export type DictationMarkStatus = "hit" | "missed";

export interface DictationMark {
  word: string;
  status: DictationMarkStatus;
}

export interface DictationGrade {
  marks: DictationMark[];
  /** Palavras digitadas que não correspondem a nenhuma palavra da resposta. */
  extras: string[];
  hits: number;
  missed: number;
  total: number;
  /** Percentual de palavras corretas (0-100). */
  score: number;
}

/** Alinha a resposta digitada à frase correta via LCS palavra a palavra. */
function lcsHitIndices(norms: string[], said: string[]): { hitI: Set<number>; hitJ: Set<number> } {
  const n = norms.length;
  const m = said.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i]![j] =
        norms[i - 1] === said[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const hitI = new Set<number>();
  const hitJ = new Set<number>();
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (norms[i - 1] === said[j - 1] && dp[i]![j] === dp[i - 1]![j - 1]! + 1) {
      hitI.add(i - 1);
      hitJ.add(j - 1);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return { hitI, hitJ };
}

/** WFD: +1 por palavra correta (normaliza casing/pontuação); extras são palavras sobrando. */
export function gradeDictation(answer: string, typed: string): DictationGrade {
  const target = tokenize(answer);
  const norms = target.map(normalizeWord);
  const said = tokenize(typed)
    .map(normalizeWord)
    .filter((w) => w.length > 0);

  const { hitI, hitJ } = lcsHitIndices(norms, said);
  const marks: DictationMark[] = target.map((word, i) => ({
    word,
    status: hitI.has(i) ? "hit" : "missed",
  }));
  const extras = said.filter((_, j) => !hitJ.has(j));

  const total = target.length;
  const hits = marks.filter((mk) => mk.status === "hit").length;
  const score = total > 0 ? Math.round((hits / total) * 100) : 0;
  return { marks, extras, hits, missed: total - hits, total, score };
}

// ---------- FIB (Fill in the Blanks) ----------

export interface FibBlankResult {
  answer: string;
  typed: string;
  correct: boolean;
}

export interface FibGrade {
  blanks: FibBlankResult[];
  correct: number;
  total: number;
  /** Percentual de lacunas corretas (0-100). */
  score: number;
}

/** FIB: correção tolerante a casing/pontuação, uma resposta por lacuna. */
export function gradeFib(answers: string[], inputs: string[]): FibGrade {
  const blanks: FibBlankResult[] = answers.map((answer, k) => {
    const typed = inputs[k] ?? "";
    return { answer, typed, correct: normalizeWord(typed) === normalizeWord(answer) };
  });
  const total = blanks.length;
  const correct = blanks.filter((b) => b.correct).length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { blanks, correct, total, score };
}

/**
 * Divide o texto do FIB em segmentos: palavras normais e lacunas (token "_").
 * Pontuação colada na lacuna (`_.`, `_,`, `(_)`) fica em `before`/`after` do segmento.
 */
export type FibSegment =
  { kind: "text"; word: string } | { kind: "blank"; index: number; before: string; after: string };

const BLANK_TOKEN = /^([^\w\s]*)_+([^\w\s]*)$/;

/** Conta as lacunas de um texto FIB (mesma regra de parseFibSegments). */
export function countFibBlanks(text: string): number {
  return tokenize(text).filter((w) => BLANK_TOKEN.test(w)).length;
}

export function parseFibSegments(text: string): FibSegment[] {
  let blankIndex = 0;
  return tokenize(text).map((w): FibSegment => {
    const m = BLANK_TOKEN.exec(w);
    return m
      ? { kind: "blank", index: blankIndex++, before: m[1] ?? "", after: m[2] ?? "" }
      : { kind: "text", word: w };
  });
}

// ---------- HIW (Highlight Incorrect Words) ----------

export interface HiwGrade {
  hits: number;
  falsePositives: number;
  missed: number;
  total: number;
  /** Pontuação do exame: acertos − falsos, mínimo 0. */
  raw: number;
  /** Percentual (0-100) para o histórico/dashboard. */
  percent: number;
}

export function gradeHiw(clicked: number[], errorIndexes: number[]): HiwGrade {
  const errSet = new Set(errorIndexes);
  const clicks = [...new Set(clicked)];
  const hits = clicks.filter((i) => errSet.has(i)).length;
  const falsePositives = clicks.length - hits;
  const total = errorIndexes.length;
  const raw = Math.max(0, hits - falsePositives);
  const percent = total > 0 ? Math.round((raw / total) * 100) : 0;
  return { hits, falsePositives, missed: total - hits, total, raw, percent };
}
