/**
 * Schemas de saída da IA e clamp de conteúdo (PRD projeto 11, §2.3).
 * Regra D3: o schema enviado ao modelo é estrito e SEM bounds (nada de
 * min/max/format) — os limites vivem no prompt e são aplicados aqui, em código.
 */
import { z } from "zod";

export const VERDICTS = ["wrong", "right", "mcnc"] as const;
export type AiVerdict = (typeof VERDICTS)[number];

/** Modelo A — card de palavra. */
export const wordResultSchema = z.object({
  word: z.string(),
  literal: z.string(),
  inSentence: z.object({
    translation: z.string(),
    why: z.string(),
  }),
  synonym: z.object({
    common: z.string(),
    verdict: z.enum(["wrong", "right", "mcnc"]),
    explanation: z.string(),
  }),
});
export type AiWordResult = z.infer<typeof wordResultSchema>;

/** Modelo B — card de frase. */
export const phraseResultSchema = z.object({
  translation: z.string(),
  tips: z.array(z.object({ term: z.string(), note: z.string() })),
});
export type AiPhraseResult = z.infer<typeof phraseResultSchema>;

export const AI_LIMITS = {
  literal: 200,
  inSentenceTranslation: 240,
  inSentenceWhy: 240,
  synonymCommon: 60,
  synonymExplanation: 240,
  phraseTranslation: 400,
  tipTerm: 80,
  tipNote: 200,
  maxTips: 6,
} as const;

const clampText = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const pick = (obj: unknown, key: string): unknown =>
  obj != null && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined;

/**
 * Valida e corta a saída de palavra. Qualquer resultado que não carregue
 * conteúdo real (veredito inválido, literal vazio) vira `null` — o cliente
 * então usa o fallback estático (D5: nenhuma tradução inventada).
 */
export function clampWordResult(raw: unknown): AiWordResult | null {
  const verdict = pick(pick(raw, "synonym"), "verdict");
  if (typeof verdict !== "string" || !VERDICTS.includes(verdict as AiVerdict)) return null;
  const literal = clampText(pick(raw, "literal"), AI_LIMITS.literal);
  const translation = clampText(
    pick(pick(raw, "inSentence"), "translation"),
    AI_LIMITS.inSentenceTranslation,
  );
  if (!literal || !translation) return null;
  return {
    word: clampText(pick(raw, "word"), 60) || literal,
    literal,
    inSentence: {
      translation,
      why: clampText(pick(pick(raw, "inSentence"), "why"), AI_LIMITS.inSentenceWhy),
    },
    synonym: {
      common: clampText(pick(pick(raw, "synonym"), "common"), AI_LIMITS.synonymCommon),
      verdict: verdict as AiVerdict,
      explanation: clampText(
        pick(pick(raw, "synonym"), "explanation"),
        AI_LIMITS.synonymExplanation,
      ),
    },
  };
}

/**
 * Valida e corta a saída de frase: no máximo 6 dicas, cada uma com termo e
 * explicação não vazios; tradução vazia invalida o resultado (fallback D5).
 */
export function clampPhraseResult(raw: unknown): AiPhraseResult | null {
  const translation = clampText(pick(raw, "translation"), AI_LIMITS.phraseTranslation);
  if (!translation) return null;
  const rawTips = pick(raw, "tips");
  const tips: AiPhraseResult["tips"] = [];
  if (Array.isArray(rawTips)) {
    for (const tip of rawTips) {
      if (tips.length >= AI_LIMITS.maxTips) break;
      const term = clampText(pick(tip, "term"), AI_LIMITS.tipTerm);
      const note = clampText(pick(tip, "note"), AI_LIMITS.tipNote);
      if (term && note) tips.push({ term, note });
    }
  }
  return { translation, tips };
}
