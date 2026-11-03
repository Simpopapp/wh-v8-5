import { describe, expect, it } from "vitest";

import {
  AI_TYPE_FOCUS,
  buildPhrasePrompt,
  buildWordPrompt,
  firstTipAsContextual,
  focusForType,
  markBlanks,
  TASK_TYPES,
} from "@/lib/plus/aiPrompts";
import { AI_LIMITS, clampPhraseResult, clampWordResult } from "@/lib/plus/aiSchemas";

describe("AI_TYPE_FOCUS (22 tipos)", () => {
  it("cobre exatamente os 22 task types", () => {
    expect(Object.keys(AI_TYPE_FOCUS).sort()).toEqual([...TASK_TYPES].sort());
    expect(TASK_TYPES).toHaveLength(22);
  });

  it("cada tipo tem contexto e foco não vazios", () => {
    for (const type of TASK_TYPES) {
      expect(AI_TYPE_FOCUS[type].context.length).toBeGreaterThan(0);
      expect(AI_TYPE_FOCUS[type].focus.length).toBeGreaterThan(0);
    }
  });

  it("tipo desconhecido cai no foco genérico", () => {
    expect(focusForType("tipo_inexistente").context).toBe("texto de estudo");
    expect(focusForType("tipo_inexistente").focus).toBe("tradução natural e fiel");
    expect(focusForType("swt")).toEqual(AI_TYPE_FOCUS.swt);
  });
});

describe("buildWordPrompt", () => {
  it("foco do tipo entra no prompt (reorder fala de conectores)", () => {
    const { messages } = buildWordPrompt({
      word: "however",
      sentence: "However, the results were inconclusive.",
      taskType: "reorder_paragraphs",
    });
    expect(messages[0]?.role).toBe("user");
    expect(String(messages[0]?.content)).toContain("conectores discursivos");
  });

  it("MCQ carrega a regra de não revelar a resposta", () => {
    const { messages } = buildWordPrompt({
      word: "scarce",
      sentence: "Water was scarce.",
      taskType: "mcq_single",
    });
    expect(String(messages[0]?.content)).toContain("múltipla escolha");
  });

  it("lacunas chegam marcadas como [lacuna]", () => {
    const { messages } = buildWordPrompt({
      word: "dominant",
      sentence: "The ______(2) species adapted quickly.",
      taskType: "read_fib",
    });
    expect(String(messages[0]?.content)).toContain("The [lacuna] species");
    expect(String(messages[0]?.content)).not.toContain("______");
  });

  it("questionText é incluído quando presente", () => {
    const { messages } = buildWordPrompt({
      word: "urban",
      sentence: "Urban areas expanded.",
      questionText: "Cities grew in the 1990s.",
      taskType: "swt",
    });
    expect(String(messages[0]?.content)).toContain("Cities grew in the 1990s.");
  });
});

describe("buildPhrasePrompt", () => {
  it("pede tradução completa + dicas intercaladas com limites do PRD", () => {
    const { messages } = buildPhrasePrompt({
      sentence: "Break a leg tonight!",
      taskType: "repeat_sentence",
    });
    const content = String(messages[0]?.content);
    expect(content).toContain("translation");
    expect(content).toContain(`0 a ${AI_LIMITS.maxTips}`);
  });

  it("reorder envia frases vizinhas; MCQ envia alternativas", () => {
    const reorder = buildPhrasePrompt({
      sentence: "The study concluded in 2019.",
      taskType: "reorder_paragraphs",
      neighbors: ["It began in 2017.", "The study concluded in 2019."],
    });
    const mcq = buildPhrasePrompt({
      sentence: "The author implies that…",
      taskType: "mcq_single",
      options: ["option A", "option B", "option C"],
    });
    expect(String(reorder.messages[0]?.content)).toContain("Frases vizinhas");
    expect(String(mcq.messages[0]?.content)).toContain("Alternativas da questão");
  });

  it("prompt da frase sem tips garantidas não promete dica para uso literal", () => {
    const { messages } = buildPhrasePrompt({ sentence: "She walked home.", taskType: "wfd" });
    expect(String(messages[0]?.content)).toContain("Não inclua dica");
  });
});

describe("clampWordResult", () => {
  const base = {
    word: "scarce",
    literal: "raro; insuficiente",
    inSentence: { translation: "escasso na região", why: "descreve falta de água" },
    synonym: {
      common: "rare",
      verdict: "wrong",
      explanation: "rare falaria de raridade, não de falta",
    },
  };

  it("mantém um resultado válido", () => {
    expect(clampWordResult(base)).toMatchObject({ word: "scarce", synonym: { verdict: "wrong" } });
  });

  it("corta campos ao limite do PRD", () => {
    const long = {
      ...base,
      literal: "a".repeat(500),
      inSentence: { translation: "b".repeat(500), why: "c".repeat(500) },
      synonym: { common: "d".repeat(500), verdict: "right", explanation: "e".repeat(500) },
    };
    const clamped = clampWordResult(long);
    expect(clamped?.literal.length).toBe(AI_LIMITS.literal);
    expect(clamped?.inSentence.translation.length).toBe(AI_LIMITS.inSentenceTranslation);
    expect(clamped?.synonym.common.length).toBe(AI_LIMITS.synonymCommon);
  });

  it("rejeita veredito inválido (fallback estático, D5)", () => {
    expect(
      clampWordResult({ ...base, synonym: { ...base.synonym, verdict: "talvez" } }),
    ).toBeNull();
  });

  it("rejeita resultado sem conteúdo real", () => {
    expect(clampWordResult({ ...base, literal: "  " })).toBeNull();
    expect(clampWordResult(null)).toBeNull();
    expect(clampWordResult("texto")).toBeNull();
  });
});

describe("clampPhraseResult", () => {
  it("mantém tradução e dicas válidas", () => {
    const clamped = clampPhraseResult({
      translation: "Que você se saia muito bem hoje!",
      tips: [{ term: "break a leg", note: "expressão de boa sorte, não literal" }],
    });
    expect(clamped?.tips).toHaveLength(1);
    expect(clamped?.tips[0]?.term).toBe("break a leg");
  });

  it("limita a 6 dicas e descarta itens incompletos", () => {
    const tips = Array.from({ length: 9 }, (_, i) => ({ term: `t${i}`, note: `n${i}` }));
    tips.push({ term: "vazio", note: "" });
    const clamped = clampPhraseResult({ translation: "ok", tips });
    expect(clamped?.tips).toHaveLength(AI_LIMITS.maxTips);
    expect(clamped?.tips.some((t) => t.note === "")).toBe(false);
  });

  it("rejeita tradução vazia", () => {
    expect(clampPhraseResult({ translation: "", tips: [] })).toBeNull();
  });

  it("tradução é cortada ao limite", () => {
    const clamped = clampPhraseResult({ translation: "x".repeat(600), tips: [] });
    expect(clamped?.translation.length).toBe(AI_LIMITS.phraseTranslation);
  });
});

describe("firstTipAsContextual", () => {
  it("formata termo — nota", () => {
    const result = { translation: "t", tips: [{ term: "break a leg", note: "boa sorte" }] };
    expect(firstTipAsContextual(result as never)).toBe("break a leg — boa sorte");
  });

  it("sem dicas retorna undefined", () => {
    expect(firstTipAsContextual({ translation: "t", tips: [] } as never)).toBeUndefined();
  });
});
