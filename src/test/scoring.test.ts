import { describe, expect, it } from "vitest";

import { countRepetitions, gradePassage, normalizeWord } from "@/lib/scoring";
import { tokenize } from "@/lib/pte";

const passage =
  "The rapid expansion of urban areas requires careful planning and sustainable design.";
const words = tokenize(passage);

describe("Correção com ordem (alinhamento)", () => {
  it("leitura perfeita mantém 100% e tudo hit", () => {
    const g = gradePassage(
      words,
      "the rapid expansion of urban areas requires careful planning and sustainable design",
      6000,
    );
    expect(g.score).toBe(100);
    expect(g.marks.every((m) => m.status === "hit")).toBe(true);
    expect(g.gradable).toBe(true);
  });

  it("palavra dita fora de ordem viram moved com crédito parcial", () => {
    const g = gradePassage(
      words,
      "the expansion rapid of urban areas requires careful planning and sustainable design",
      6000,
    );
    const rapid = g.marks.find((m) => m.word === "rapid");
    const expansion = g.marks.find((m) => m.word === "expansion");
    // na troca vizinha, a palavra reposicionada no alinhamento leva o crédito parcial
    expect(rapid?.status).toBe("hit");
    expect(expansion?.status).toBe("moved");
    expect(g.moved).toBe(1);
    expect(g.extras).toHaveLength(0);
    expect(g.score).toBeGreaterThanOrEqual(80);
    expect(g.score).toBeLessThan(100);
  });

  it("substituição próxima continua substituted", () => {
    const g = gradePassage(
      words,
      "the rapid expansive of urban areas requires careful planning and sustainable design",
      6000,
    );
    const expansion = g.marks.find((m) => m.word === "expansion");
    expect(expansion?.status).toBe("substituted");
  });

  it("transcrição curta demais não é avaliável (guarda contra 0% injusto)", () => {
    const g = gradePassage(words, "the rapid", 4000);
    expect(g.gradable).toBe(false);
    expect(g.mastered).toBe(false);
  });

  it("transcrição vazia não é avaliável", () => {
    const g = gradePassage(words, "", 4000);
    expect(g.gradable).toBe(false);
  });

  it("pausas passadas via options aparecem no resultado", () => {
    const g = gradePassage(
      words,
      "the rapid expansion of urban areas requires careful planning and sustainable design",
      12000,
      {
        pauses: 3,
      },
    );
    expect(g.pauses).toBe(3);
  });
});

describe("Repetições", () => {
  it("palavra repetida em sequência conta", () => {
    expect(countRepetitions(["the", "the", "city"])).toBe(1);
  });

  it("bigrama repetido imediatamente conta uma vez", () => {
    expect(countRepetitions(["in", "the", "in", "the", "city"])).toBe(1);
  });

  it("fala normal não conta repetição", () => {
    expect(countRepetitions(["the", "city", "grows", "fast"])).toBe(0);
  });
});

describe("normalização", () => {
  it("mantém comportamento anterior", () => {
    expect(normalizeWord("Design.")).toBe("design");
  });
});
