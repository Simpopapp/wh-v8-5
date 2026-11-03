// Correção pura (sem React) de resumos: SWT (frase única, 5-75) e SST (50-70 palavras).

import { tokenize } from "./types";

export const SWT_MIN_WORDS = 5;
export const SWT_MAX_WORDS = 75;
export const SST_MIN_WORDS = 50;
export const SST_MAX_WORDS = 70;
/** Zona "próxima" do SST — desconta menos que fora da faixa. */
export const SST_NEAR_MIN = 40;
export const SST_NEAR_MAX = 80;
/** Cronômetro do SST (10:00). */
export const SST_TOTAL_SECONDS = 600;

export type WordZone = "short" | "ok" | "long";

export function wordZoneOf(count: number, min: number, max: number): WordZone {
  if (count < min) return "short";
  if (count > max) return "long";
  return "ok";
}

export interface SummaryGrade {
  words: number;
  zone: WordZone;
  /** SWT: 1 = frase única válida. */
  sentenceCount: number;
  singleSentence: boolean;
  /** 0-100: cobertura das keywords do texto-fonte. */
  coverage: number;
  /** Keywords do texto-fonte presentes no resumo. */
  covered: string[];
  /** Keywords do texto-fonte ausentes no resumo. */
  missed: string[];
  /** Conectivos detectados no resumo (complexidade de frase). */
  connectives: string[];
  /** Score geral 0-100. */
  score: number;
}

// Palavras funcionais (não são keywords). Lista enxuta e determinística.
const STOPWORDS = new Set(
  (
    "a about above after again against ain all am an and any are aren as at be because been before being below between both but by " +
    "can couldn d did didn do does doesn doing don down during each few for from further had hadn has hasn have haven having he her here hers " +
    "herself him himself his how i if in into is isn it its itself just ll m ma me mightn more most mustn my myself needn no nor not now o of " +
    "off on once only or other our ours ourselves out over own re s same shan she should shouldn so some such t than that the their theirs them " +
    "themselves then there these they this those through to too under until up ve very was wasn we were weren what when where which while who whom " +
    "why will with won would wouldn y you your yours yourself yourselves"
  ).split(" "),
);

/** Conectivos/estruturadores que valem ponto de complexidade no SWT. */
const CONNECTIVES = [
  "although",
  "though",
  "even though",
  "while",
  "whereas",
  "despite",
  "in spite of",
  "because",
  "since",
  "which",
  "who",
  "however",
  "therefore",
  "moreover",
  "furthermore",
  "in addition",
  "as well as",
  "and",
  "but",
  "so that",
];

function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/'s$/, "");
}

/** Palavras de conteúdo (sem stopwords) de um texto, normalizadas. */
export function contentWords(text: string): string[] {
  return tokenize(text)
    .map(normalizeWord)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/** Top keywords do texto-fonte por frequência (ordem estável: freq desc, depois alfabética). */
export function extractKeywords(text: string, limit = 12): string[] {
  const freq = new Map<string, number>();
  for (const w of contentWords(text)) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

/** Número de frases terminadas por ponto/interrogação/exclamação. */
export function countSentences(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
}

function detectConnectives(answer: string): string[] {
  const lower = ` ${answer
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")} `;
  const found = CONNECTIVES.filter((c) => lower.includes(` ${c} `));
  return found;
}

function coverageOf(
  sourceText: string,
  answer: string,
): {
  coverage: number;
  covered: string[];
  missed: string[];
} {
  const keywords = extractKeywords(sourceText);
  const answerWords = new Set(contentWords(answer));
  const covered = keywords.filter((k) => answerWords.has(k));
  const missed = keywords.filter((k) => !answerWords.has(k));
  const coverage =
    keywords.length === 0 ? 100 : Math.round((covered.length / keywords.length) * 100);
  return { coverage, covered, missed };
}

/** Corrige um Summarize Written Text: frase única, 5-75 palavras, keywords + conectivos. */
export function gradeSwt(sourceText: string, answer: string): SummaryGrade {
  const words = answer.trim() ? tokenize(answer).length : 0;
  const zone = wordZoneOf(words, SWT_MIN_WORDS, SWT_MAX_WORDS);
  const sentenceCount = countSentences(answer);
  const singleSentence = sentenceCount === 1;
  const { coverage, covered, missed } = coverageOf(sourceText, answer);
  const connectives = detectConnectives(answer);

  // Sem resposta → score 0, sem Pontos de zona.
  const coveragePts = words === 0 ? 0 : coverage * 0.6;
  const zonePts = words === 0 ? 0 : zone === "ok" ? 25 : 8;
  const sentencePts = singleSentence ? 15 : 0;
  const score = Math.round(coveragePts + zonePts + sentencePts);

  return {
    words,
    zone,
    sentenceCount,
    singleSentence,
    coverage,
    covered,
    missed,
    connectives,
    score: Math.max(0, Math.min(100, score)),
  };
}

/** Corrige um Summarize Spoken Text: 50-70 palavras, cobertura semântica da transcrição. */
export function gradeSst(transcript: string, answer: string): SummaryGrade {
  const words = answer.trim() ? tokenize(answer).length : 0;
  const zone = wordZoneOf(words, SST_MIN_WORDS, SST_MAX_WORDS);
  const sentenceCount = countSentences(answer);
  const singleSentence = sentenceCount === 1;
  const { coverage, covered, missed } = coverageOf(transcript, answer);
  const connectives = detectConnectives(answer);

  // Sem resposta → score 0, sem pontos de zona.
  const coveragePts = words === 0 ? 0 : coverage * 0.7;
  const near =
    (words >= SST_NEAR_MIN && words < SST_MIN_WORDS) ||
    (words > SST_MAX_WORDS && words <= SST_NEAR_MAX);
  const zonePts = words === 0 ? 0 : zone === "ok" ? 30 : near ? 12 : 0;
  const score = Math.round(coveragePts + zonePts);

  return {
    words,
    zone,
    sentenceCount,
    singleSentence,
    coverage,
    covered,
    missed,
    connectives,
    score: Math.max(0, Math.min(100, score)),
  };
}
