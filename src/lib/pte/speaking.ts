// Correção pura (sem React) do Motor A — Speaking:
// Repeat Sentence (alinhamento exato), Retell Lecture (keywords + fluência)
// e Answer Short Question (matching com alternativas).

import { gradePassage, type GradeResult } from "@/lib/scoring";
import { contentWords, extractKeywords } from "./summary";
import { tokenize } from "./types";

/** Remove marcadores de repetição dos dados brutos, ex.: "_(3 times)_". */
export function cleanSpeakingText(text: string): string {
  return text
    .replace(/_\([^)]*\)_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tempo máximo de gravação por tipo (ms). */
export const RS_MAX_RECORD_MS = 15000;
export const RL_MAX_RECORD_MS = 40000;
export const ASQ_MAX_RECORD_MS = 10000;
// Fase 7 (projeto 9): tempos oficiais dos 3 tipos novos.
export const SGD_PREP_SECONDS = 10;
export const SGD_MAX_RECORD_MS = 120000; // 2 minutos
export const RTS_PREP_SECONDS = 10;
export const RTS_MAX_RECORD_MS = 40000;
export const DI_PREP_SECONDS = 25;
export const DI_MAX_RECORD_MS = 40000;

/** Contagem de preparação por tipo (s). */
export const RS_PREP_SECONDS = 3;
export const RL_PREP_SECONDS = 10;
export const ASQ_PREP_SECONDS = 3;

// ---------- Repeat Sentence ----------

/**
 * Corrige uma repetição de frase: alinhamento palavra a palavra contra a
 * frase de referência (reaproveita o motor de Read Aloud) + proxies de
 * fluência (wpm, pausas, repetições).
 */
export function gradeRepeatSentence(
  reference: string,
  transcript: string,
  durationMs: number,
  pauses = 0,
): GradeResult {
  const words = tokenize(cleanSpeakingText(reference));
  return gradePassage(words, transcript, durationMs, { pauses });
}

// ---------- Retell Lecture ----------

export interface RetellGrade {
  /** 0-100: cobertura das keywords da palestra. */
  coverage: number;
  covered: string[];
  missed: string[];
  /** Palavras ditas por minuto. */
  wpm: number;
  /** Pausas longas detectadas. */
  pauses: number;
  /** Repetições imediatas (palavra ou bigrama). */
  repetitions: number;
  /** Score geral 0-100 (conteúdo 70% + fluência 30%). */
  score: number;
  /** false quando a fala é curta demais para avaliar. */
  gradable: boolean;
  transcript: string;
}

/**
 * Corrige um Retell Lecture: cobertura das keywords da transcrição da
 * palestra (70%) + fluência (30%: ritmo 60-180 wpm, poucas pausas/repetições).
 */
export function gradeRetell(
  lectureTranscript: string,
  transcript: string,
  durationMs: number,
  pauses = 0,
): RetellGrade {
  const clean = transcript.replace(/\s+/g, " ").trim();
  const saidWords = contentWords(clean);
  const minutes = durationMs / 60000;
  const wpm = minutes > 0.05 ? Math.round(tokenize(clean).length / minutes) : 0;

  const keywords = extractKeywords(lectureTranscript, 12);
  const saidSet = new Set(saidWords);
  const covered = keywords.filter((k) => saidSet.has(k));
  const missed = keywords.filter((k) => !saidSet.has(k));
  const coverage = keywords.length === 0 ? 0 : Math.round((covered.length / keywords.length) * 100);

  // Fluência: ritmo na faixa 60-180 wpm vale 15; pausas e repetições descontam de 15.
  const pacePts = wpm >= 60 && wpm <= 180 ? 15 : wpm > 0 ? 7 : 0;
  const smoothPts = Math.max(0, 15 - pauses * 4 - countRepetitionsLocal(clean) * 3);
  const fluency = pacePts + smoothPts;

  const gradable = saidWords.length >= 5;
  const score = gradable ? Math.round(coverage * 0.7 + fluency) : 0;

  return {
    coverage,
    covered,
    missed,
    wpm,
    pauses: Math.max(0, Math.floor(pauses)),
    repetitions: countRepetitionsLocal(clean),
    score: Math.max(0, Math.min(100, score)),
    gradable,
    transcript: clean,
  };
}

function countRepetitionsLocal(text: string): number {
  const tokens = tokenize(text.toLowerCase());
  let reps = 0;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) {
      reps += 1;
      continue;
    }
    if (i >= 3 && tokens[i] === tokens[i - 2] && tokens[i - 1] === tokens[i - 3]) reps += 1;
  }
  return reps;
}

// ---------- Answer Short Question ----------

export interface ShortAnswerGrade {
  correct: boolean;
  /** Alternativa que casou (ou null). */
  matched: string | null;
  /** Todas as alternativas aceitas. */
  alternatives: string[];
  /** Score 0 ou 100. */
  score: number;
  transcript: string;
}

/** Separa alternativas de resposta: "autumn or fall" → ["autumn", "fall"]. */
export function parseAlternatives(answer: string): string[] {
  return answer
    .split(/\s+or\s+|\s*\/\s*|\s*,\s*/i)
    .map((a) => a.trim())
    .filter(Boolean);
}

function normPhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Corrige Answer Short Question: aceita qualquer alternativa (exata ou
 * contida na transcrição). Sem resposta reconhecida → incorreta.
 */
export function gradeAnswerShort(answer: string, transcript: string): ShortAnswerGrade {
  const clean = transcript.replace(/\s+/g, " ").trim();
  const alternatives = parseAlternatives(answer);
  const said = normPhrase(clean);
  const matched =
    alternatives.find((alt) => {
      const a = normPhrase(alt);
      return a.length > 0 && (said === a || said.includes(a));
    }) ?? null;
  return {
    correct: matched !== null,
    matched,
    alternatives,
    score: matched ? 100 : 0,
    transcript: clean,
  };
}
