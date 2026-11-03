// API legada de Read Aloud (148 questões) — mantém as rotas /practice, /session e /progress.

import readAloudJson from "@/data/pte/read_aloud.json";
import { tokenize } from "./types";

export interface Question {
  id: string;
  text: string;
  words: string[];
  wordCount: number;
  topic: string;
  prompt: string;
  gradingNotes: string;
  source: string;
}

interface RawQuestion {
  id?: string;
  text?: string;
  content?: string;
  word_count?: number;
  topic?: string;
  prompt?: string;
  grading_notes?: string;
  source?: string;
}

const rawQuestions = ((readAloudJson as { questions?: RawQuestion[] }).questions ??
  []) as RawQuestion[];

export { tokenize };

export const questions: Question[] = rawQuestions
  .map((q, i) => {
    const text = (String(q.content ?? "").trim() || String(q.text ?? "").trim())
      .replace(/\s+/g, " ")
      .trim();
    const words = tokenize(text);
    return {
      id: String(q.id ?? "").trim() || `pte-ra-${i + 1}`,
      text,
      words,
      wordCount: typeof q.word_count === "number" && q.word_count > 0 ? q.word_count : words.length,
      topic: String(q.topic ?? "").trim() || "sem tópico",
      prompt: String(q.prompt ?? "").trim(),
      gradingNotes: String(q.grading_notes ?? "").trim(),
      source: String(q.source ?? "").trim(),
    };
  })
  .filter((q) => q.text.length > 0);

export const TOTAL_QUESTIONS = questions.length;

export const topics: { topic: string; count: number }[] = Array.from(
  questions.reduce(
    (map, q) => map.set(q.topic, (map.get(q.topic) ?? 0) + 1),
    new Map<string, number>(),
  ),
)
  .map(([topic, count]) => ({ topic, count }))
  .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

const byId = new Map(questions.map((q) => [q.id, q]));

export function getQuestion(id: string | undefined): Question | undefined {
  return id ? byId.get(id) : undefined;
}

export function questionIndex(id: string): number {
  return questions.findIndex((q) => q.id === id);
}

export function nextQuestionId(id: string): string {
  const i = questionIndex(id);
  return questions[(i + 1) % questions.length]?.id ?? questions[0]?.id ?? id;
}

export function prevQuestionId(id: string): string {
  const i = questionIndex(id);
  return questions[(i - 1 + questions.length) % questions.length]?.id ?? id;
}

/** Primeira questão (ordem do banco) ainda não dominada; se todas dominadas, a menos recente tentada. */
export function pickContinueId(
  isMastered: (id: string) => boolean,
  lastAttemptOf: (id: string) => number,
): string {
  const first = questions.find((q) => !isMastered(q.id));
  if (first) return first.id;
  return questions.reduce((best, q) => {
    const t = lastAttemptOf(q.id);
    const b = lastAttemptOf(best);
    return t < b ? q.id : best;
  }, questions[0]?.id ?? "");
}
