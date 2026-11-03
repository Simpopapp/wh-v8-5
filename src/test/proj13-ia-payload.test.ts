// Projeto 13, Fase 0 (D9) — tetos de entrada das server functions de IA:
// payload acima do limite é rejeitado antes de chegar ao gateway.
import { describe, expect, it } from "vitest";

import { aiPhraseInputSchema, aiWordInputSchema } from "@/lib/plus/ai-translate.functions";

describe("Tetos de payload da tradução IA (D9)", () => {
  it("palavra: aceita no teto e rejeita acima (121 chars)", () => {
    const base = { sentence: "Water is scarce.", taskType: "read_aloud" };
    expect(aiWordInputSchema.safeParse({ ...base, word: "a".repeat(120) }).success).toBe(true);
    expect(aiWordInputSchema.safeParse({ ...base, word: "a".repeat(121) }).success).toBe(false);
  });

  it("sentença: rejeita acima de 2000 chars; enunciado acima de 6000", () => {
    const base = { word: "scarce", taskType: "read_aloud" };
    expect(aiWordInputSchema.safeParse({ ...base, sentence: "a".repeat(2000) }).success).toBe(true);
    expect(aiWordInputSchema.safeParse({ ...base, sentence: "a".repeat(2001) }).success).toBe(
      false,
    );
    expect(
      aiWordInputSchema.safeParse({ ...base, sentence: "s", questionText: "a".repeat(6001) })
        .success,
    ).toBe(false);
  });

  it("frase: arrays de opções/vizinhos limitados (16) e itens com teto próprio", () => {
    const base = { sentence: "Boa sorte hoje!", taskType: "wfd" };
    expect(aiPhraseInputSchema.safeParse({ ...base, options: Array(16).fill("x") }).success).toBe(
      true,
    );
    expect(aiPhraseInputSchema.safeParse({ ...base, options: Array(17).fill("x") }).success).toBe(
      false,
    );
    expect(aiPhraseInputSchema.safeParse({ ...base, neighbors: Array(17).fill("x") }).success).toBe(
      false,
    );
    expect(aiPhraseInputSchema.safeParse({ ...base, options: ["a".repeat(301)] }).success).toBe(
      false,
    );
  });

  it("sessionId fora da faixa (chave do rate limit) é rejeitada", () => {
    const base = { word: "scarce", sentence: "s", taskType: "read_aloud" };
    expect(aiWordInputSchema.safeParse({ ...base, sessionId: "curta" }).success).toBe(false);
    expect(aiWordInputSchema.safeParse({ ...base, sessionId: "s".repeat(65) }).success).toBe(false);
    expect(aiWordInputSchema.safeParse({ ...base, sessionId: "s".repeat(32) }).success).toBe(true);
  });
});
