import { describe, expect, it } from "vitest";

import { gradeDictation, gradeFib, gradeHiw, parseFibSegments } from "@/lib/pte/dictation";
import { loadTypeQuestions } from "@/lib/pte";
import type { DictationQuestion, HiwQuestion } from "@/lib/pte";

const fibQuestions = await loadTypeQuestions("lst_fib");
const hiwQuestions = await loadTypeQuestions("lst_hiw");
const wfdQuestions = await loadTypeQuestions("wfd");

describe("gradeDictation (WFD)", () => {
  it("conta +1 por palavra correta, ignorando casing e pontuação", () => {
    const g = gradeDictation(
      "A balanced diet and regular exercise are necessary for good health.",
      "a balanced diet and regular exercise are necessary for good health",
    );
    expect(g.hits).toBe(11);
    expect(g.missed).toBe(0);
    expect(g.extras).toEqual([]);
    expect(g.score).toBe(100);
  });

  it("marca palavras erradas como missed e digitadas sobrando como extras", () => {
    const g = gradeDictation("the quick brown fox jumps", "the quick red fox jumps high");
    expect(g.marks.find((m) => m.word === "brown")?.status).toBe("missed");
    expect(g.extras).toEqual(["red", "high"]);
    expect(g.score).toBe(80);
  });

  it("resposta vazia = tudo missed", () => {
    const g = gradeDictation("one two three", "");
    expect(g.hits).toBe(0);
    expect(g.score).toBe(0);
    expect(g.marks).toHaveLength(3);
  });
});

describe("gradeFib (Fill in the Blanks)", () => {
  it("aceita casing diferente e marca erros por lacuna", () => {
    const g = gradeFib(["triggered", "massive", "Tokyo"], ["Triggered", "big", "tokyo"]);
    expect(g.blanks[0]?.correct).toBe(true);
    expect(g.blanks[1]?.correct).toBe(false);
    expect(g.blanks[2]?.correct).toBe(true);
    expect(g.correct).toBe(2);
    expect(g.total).toBe(3);
    expect(g.score).toBe(67);
  });

  it("lacuna vazia conta como erro", () => {
    const g = gradeFib(["a", "b"], ["", "b"]);
    expect(g.correct).toBe(1);
  });
});

describe("gradeHiw (Highlight Incorrect Words)", () => {
  it("pontuação = acertos − falsos positivos, mínimo 0", () => {
    const g = gradeHiw([0, 2, 5, 9], [0, 2, 4]);
    expect(g.hits).toBe(2);
    expect(g.falsePositives).toBe(2);
    expect(g.raw).toBe(0);
    expect(g.missed).toBe(1);
  });

  it("raw negativo nunca sai abaixo de 0", () => {
    const g = gradeHiw([1, 2, 3], [7]);
    expect(g.raw).toBe(0);
    expect(g.percent).toBe(0);
  });

  it("destaque perfeito = score máximo", () => {
    const g = gradeHiw([3, 8], [3, 8]);
    expect(g.raw).toBe(2);
    expect(g.percent).toBe(100);
  });
});

describe("integridade dos dados dos motores", () => {
  it("todas as lacunas de FIB têm índices sequenciais a partir de 0", () => {
    expect(fibQuestions.length).toBeGreaterThan(0);
    for (const q of fibQuestions) {
      const blanks = parseFibSegments(q.text).filter((s) => s.kind === "blank");
      blanks.forEach((s, k) => expect(s.kind === "blank" && s.index).toBe(k));
    }
  });

  const hiwTyped: HiwQuestion[] = hiwQuestions.filter(
    (q): q is HiwQuestion => q.taskType === "lst_hiw",
  );
  const wfdTyped: DictationQuestion[] = wfdQuestions.filter(
    (q): q is DictationQuestion => q.taskType === "wfd",
  );

  it("errorIndexes de HIW cabem no range de tokens", () => {
    expect(hiwTyped.length).toBeGreaterThan(0);
    for (const q of hiwTyped) {
      const tokens = q.text.split(/\s+/);
      for (const i of q.errorIndexes) expect(i).toBeLessThan(tokens.length);
    }
  });

  it("WFD tem resposta de ditado", () => {
    expect(wfdTyped.length).toBeGreaterThan(0);
    for (const q of wfdTyped) expect(q.answer.length).toBeGreaterThan(0);
  });
});
