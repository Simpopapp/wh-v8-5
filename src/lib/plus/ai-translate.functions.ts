/**
 * Server functions de tradução IA (PRD projeto 11, §2.2/§8). O módulo entra no
 * grafo do cliente, mas só o corpo dos handlers é retirado do bundle: as
 * importações de servidor (`@/server/gateway`) são dinâmicas, dentro do handler.
 *
 * Projeto 13 (D9): entrada COM TETOS (strings e arrays limitados), rate limit
 * próprio por sessão anônima — o handler é público e CSRF não contém custo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildPhrasePrompt, buildWordPrompt } from "@/lib/plus/aiPrompts";
import { phraseResultSchema, wordResultSchema } from "@/lib/plus/aiSchemas";

export type AiTranslationError = {
  ok: false;
  code: "credits" | "rate" | "network" | "invalid";
  message: string;
};
export type AiWordResponse =
  { ok: true; result: import("zod").infer<typeof wordResultSchema> } | AiTranslationError;
export type AiPhraseResponse =
  { ok: true; result: import("zod").infer<typeof phraseResultSchema> } | AiTranslationError;

/** Tetos de entrada (D9): limitam custo, parsing e superfície de prompt injection. */
export const aiWordInputSchema = z.object({
  word: z.string().min(1).max(120),
  sentence: z.string().min(1).max(2000),
  questionText: z.string().max(6000).optional(),
  taskType: z.string().min(1).max(80),
  /** Sessão anônima do cliente (chave do rate limit) — não é identidade. */
  sessionId: z.string().min(8).max(64).optional(),
});

export const aiPhraseInputSchema = z.object({
  sentence: z.string().min(1).max(2000),
  taskType: z.string().min(1).max(80),
  questionText: z.string().max(6000).optional(),
  options: z.array(z.string().max(300)).max(16).optional(),
  neighbors: z.array(z.string().max(800)).max(16).optional(),
  sessionId: z.string().min(8).max(64).optional(),
});

const RATE_MESSAGE = "Muitas traduções seguidas — aguarde alguns instantes.";

export const translateAiWord = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => aiWordInputSchema.parse(input))
  .handler(async ({ data }): Promise<AiWordResponse> => {
    const { checkRateLimit } = await import("@/server/rate-limit");
    if (!checkRateLimit(data.sessionId).ok) {
      return { ok: false, code: "rate", message: RATE_MESSAGE };
    }
    const { callGatewayObject } = await import("@/server/gateway");
    const prompt = buildWordPrompt(data);
    const result = await callGatewayObject({
      instructions: prompt.instructions,
      messages: prompt.messages,
      schema: wordResultSchema,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    return { ok: true, result: result.data };
  });

export const translateAiPhrase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => aiPhraseInputSchema.parse(input))
  .handler(async ({ data }): Promise<AiPhraseResponse> => {
    const { checkRateLimit } = await import("@/server/rate-limit");
    if (!checkRateLimit(data.sessionId).ok) {
      return { ok: false, code: "rate", message: RATE_MESSAGE };
    }
    const { callGatewayObject } = await import("@/server/gateway");
    const prompt = buildPhrasePrompt(data);
    const result = await callGatewayObject({
      instructions: prompt.instructions,
      messages: prompt.messages,
      schema: phraseResultSchema,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    return { ok: true, result: result.data };
  });
