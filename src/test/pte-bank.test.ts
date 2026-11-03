import { describe, expect, it } from "vitest";

import { gradePassage, normalizeWord } from "@/lib/scoring";
import { tokenize } from "@/lib/pte";
import { getQuestion, questions, topics, TOTAL_QUESTIONS } from "@/lib/pte/readaloud";

describe("Banco de questões PTE Read Aloud", () => {
  it("carrega as 195 questões do pte.json", () => {
    expect(TOTAL_QUESTIONS).toBe(195);
    expect(questions.length).toBe(195);
  });

  it("toda questão tem texto, palavras, contagem e tópico válidos", () => {
    for (const q of questions) {
      expect(q.text.length).toBeGreaterThan(20);
      expect(q.words.length).toBeGreaterThan(0);
      expect(q.wordCount).toBeGreaterThan(0);
      expect(q.topic.length).toBeGreaterThan(0);
      expect(q.id).toMatch(/^(pte-ra-|storm-ra-|goarno-ra-)/);
    }
  });

  it("wordCount do banco bate com o texto tokenizado (com folga de ±2)", () => {
    const divergent = questions.filter((q) => Math.abs(q.wordCount - q.words.length) > 2);
    expect(divergent).toHaveLength(0);
  });

  it("índices derivados funcionam", () => {
    expect(topics.length).toBeGreaterThan(0);
    const first = questions[0]!;
    expect(getQuestion(first.id)?.id).toBe(first.id);
    expect(getQuestion("id-inexistente")).toBeUndefined();
  });
});

describe("Correção de conteúdo", () => {
  const passage = "Cities expanded rapidly as workers moved from rural areas.";
  const words = tokenize(passage);

  it("normaliza pontuação e caixa", () => {
    expect(normalizeWord("Cities,")).toBe("cities");
    expect(normalizeWord("areas.")).toBe("areas");
  });

  it("leitura perfeita = 100% e dominada (ritmo ideal)", () => {
    const g = gradePassage(
      words,
      "cities expanded rapidly as workers moved from rural areas",
      4500,
    );
    expect(g.score).toBe(100);
    expect(g.marks.every((m) => m.status === "hit")).toBe(true);
    expect(g.paceVerdict).toBe("ideal");
    expect(g.mastered).toBe(true);
  });

  it("omissões aparecem no mapa e derrubam o score", () => {
    const g = gradePassage(words, "cities expanded rapidly workers moved from rural", 25000);
    expect(g.hits).toBeLessThan(words.length);
    expect(g.marks.filter((m) => m.status === "missed").map((m) => m.word)).toEqual([
      "as",
      "areas.",
    ]);
    expect(g.score).toBeLessThan(100);
    expect(g.mastered).toBe(false);
  });

  it("substituição próxima é marcada como substituted", () => {
    const g = gradePassage(words, "cities expands rapidly as workers moved from rural areas", 4500);
    const expanded = g.marks.find((m) => m.word === "expanded");
    expect(expanded?.status).toBe("substituted");
  });

  it("interjeições não contam como conteúdo", () => {
    const g = gradePassage(
      words,
      "uh cities expanded rapidly as workers moved from rural areas",
      4500,
    );
    expect(g.extras).toHaveLength(0);
    expect(g.score).toBe(100);
  });

  it("ritmo fora da faixa bloqueia dominada", () => {
    const g = gradePassage(
      words,
      "cities expanded rapidly as workers moved from rural areas",
      3200,
    );
    expect(g.score).toBe(100);
    expect(g.paceVerdict).toBe("fast");
    expect(g.mastered).toBe(false);
  });
});
