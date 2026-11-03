// Correção pura de Write Essay (fase 5).
// Combina forma (zona 200–300 palavras), cobertura de keywords da resposta
// modelo e estrutura (parágrafos + conectivos) em um score 0–100.

import { contentWords, extractKeywords, wordZoneOf } from "./summary";
import { tokenize } from "./types";

export const ESSAY_MIN_WORDS = 200;
export const ESSAY_MAX_WORDS = 300;

export interface EssayGrade {
  words: number;
  zone: "short" | "ok" | "long";
  /** Parágrafos não vazios (o PTE espera 4: intro, 2 corpo, conclusão). */
  paragraphs: number;
  /** Keywords da resposta modelo que apareceram no ensaio. */
  covered: string[];
  missed: string[];
  /** Conectivos/conectores acadêmicos detectados. */
  connectives: string[];
  score: 0 | 100 | number;
  /** Ensaios fora da zona de palavras são penalizados (form = 0 no PTE real). */
  formOk: boolean;
}

const CONNECTIVES = [
  "to begin with",
  "firstly",
  "furthermore",
  "moreover",
  "in addition",
  "however",
  "on the other hand",
  "in contrast",
  "for example",
  "for instance",
  "as a result",
  "consequently",
  "therefore",
  "in conclusion",
  "to conclude",
  "overall",
  "nevertheless",
  "whereas",
  "while",
  "although",
];

export function gradeEssay(answer: string, sample: string): EssayGrade {
  const words = tokenize(answer).length;
  const zone = wordZoneOf(words, ESSAY_MIN_WORDS, ESSAY_MAX_WORDS);
  const formOk = zone === "ok";

  const paragraphs = answer
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;

  const answerLower = answer.toLowerCase();
  const keywords = extractKeywords(sample, 10);
  const covered: string[] = [];
  const missed: string[] = [];
  for (const k of keywords) {
    // keyword pode ser composta ("global warming")
    (answerLower.includes(k.toLowerCase()) ? covered : missed).push(k);
  }
  const coverage = keywords.length === 0 ? 0 : covered.length / keywords.length;

  const connectives = CONNECTIVES.filter((c) => answerLower.includes(c));

  // Pesos: forma 30 · cobertura 45 · estrutura 25 (parágrafos ≥ 3 + ≥ 2 conectivos).
  let score = 0;
  if (formOk) score += 30;
  else if (zone === "short" && words >= Math.round(ESSAY_MIN_WORDS * 0.85)) score += 12;
  else if (zone === "long" && words <= Math.round(ESSAY_MAX_WORDS * 1.15)) score += 12;
  score += Math.round(coverage * 45);
  const structure =
    (paragraphs >= 3 ? 15 : paragraphs >= 2 ? 8 : 0) + (connectives.length >= 2 ? 10 : 0);
  score += structure;
  score = Math.min(100, score);

  return {
    words,
    zone,
    paragraphs,
    covered,
    missed,
    connectives,
    score,
    formOk,
  };
}

/** Palavras de conteúdo (para estatísticas e destaque do modelo). */
export function essayContentWords(text: string): string[] {
  return contentWords(text);
}
