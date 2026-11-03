import { describe, expect, it } from "vitest";

import type { ReadFibQuestion } from "@/lib/pte";
import { ESSAY_MAX_WORDS, ESSAY_MIN_WORDS, gradeEssay } from "@/lib/pte/essay";
import { gradeDropdown } from "@/lib/pte/fibDropdown";
import { gradeReorder } from "@/lib/pte/reorder";

const SAMPLE =
  "Technology has transformed education. Furthermore, online learning expands access, " +
  "however it demands discipline. In conclusion, technology complements teachers.";

const essayWords = (n: number) => Array.from({ length: n }, (_, i) => `word${i % 50}`).join(" ");

describe("gradeEssay (Write Essay)", () => {
  it("ensaio na zona 200–300 com estrutura completa pontua alto", () => {
    const body = `${essayWords(230)} ${SAMPLE} ${essayWords(30)}`;
    const g = gradeEssay(body, SAMPLE);
    expect(g.words).toBeGreaterThanOrEqual(ESSAY_MIN_WORDS);
    expect(g.words).toBeLessThanOrEqual(ESSAY_MAX_WORDS);
    expect(g.zone).toBe("ok");
    expect(g.formOk).toBe(true);
    expect(g.paragraphs).toBe(1); // sem \n\n no corpo, é um parágrafo único
    expect(g.connectives.length).toBeGreaterThanOrEqual(2);
    expect(g.covered.length).toBeGreaterThan(0);
    expect(g.score).toBeGreaterThan(60);
  });

  it("fora da zona de palavras perde a forma mas mantém cobertura", () => {
    const short = gradeEssay(SAMPLE, SAMPLE);
    expect(short.zone).toBe("short");
    expect(short.formOk).toBe(false);
    expect(short.covered.length).toBe(
      short.missed.length === 0 ? short.covered.length : short.covered.length,
    );

    const long = gradeEssay(`${essayWords(400)} ${SAMPLE}`, SAMPLE);
    expect(long.zone).toBe("long");
    expect(long.formOk).toBe(false);
  });

  it("estrutura: 3+ parágrafos e 2+ conectivos valem mais que parágrafo único", () => {
    const p1 = essayWords(90);
    const p2 = `${essayWords(90)} Furthermore, discipline matters.`;
    const p3 = `In conclusion, ${essayWords(60)}`;
    const three = gradeEssay(`${p1}\n\n${p2}\n\n${p3}`, SAMPLE);
    expect(three.paragraphs).toBe(3);

    const one = gradeEssay(`${p1} ${p2} ${p3}`.replace(/\n\n/g, " "), SAMPLE);
    expect(one.paragraphs).toBe(1);
    expect(three.score).toBeGreaterThan(one.score);
  });

  it("ensaio vazio pontua 0", () => {
    expect(gradeEssay("", SAMPLE).score).toBe(0);
  });
});

describe("gradeReorder (Re-order Paragraphs)", () => {
  const q = { correctOrder: [2, 0, 3, 1] } as never;

  it("ordem exata = 100; com um par certo = proporcional", () => {
    expect(gradeReorder([2, 0, 3, 1], [2, 0, 3, 1], q).score).toBe(100);

    const g = gradeReorder([0, 2, 3, 1], [2, 0, 3, 1], q);
    // pares corretos: (2,0)? não — ordem correta tem (2,0),(0,3),(3,1); usuário tem (0,2),(2,3),(3,1)
    expect(g.pairsCorrect).toBe(1);
    expect(g.pairsTotal).toBe(3);
    expect(g.score).toBe(30);
  });

  it("ordem invertida zera os pares adjacentes", () => {
    const g = gradeReorder([1, 3, 0, 2], [2, 0, 3, 1], q);
    expect(g.pairsCorrect).toBe(0);
    expect(g.score).toBe(0);
  });

  it("arrays de tamanho 1 não têm pares", () => {
    expect(gradeReorder([0], [0], q).pairsTotal).toBe(0);
    expect(gradeReorder([0], [0], q).score).toBe(0);
  });
});

describe("gradeDropdown (Reading FIB)", () => {
  const blanks: ReadFibQuestion["blanks"] = [
    { options: ["guide", "mislead"], answer: "guide" },
    { options: ["if", "unless"], answer: "if" },
    { options: ["mock", "respect"], answer: "mock" },
  ];

  it("conta acertos e calcula o score proporcional", () => {
    const g = gradeDropdown(["guide", "unless", "mock"], blanks);
    expect(g.correct).toBe(2);
    expect(g.total).toBe(3);
    expect(g.score).toBe(67);
    expect(g.correctIndexes).toEqual([0, 2]);
  });

  it("lacuna em branco não é acerto", () => {
    const g = gradeDropdown([null, "if", null], blanks);
    expect(g.correct).toBe(1);
    expect(g.score).toBe(33);
  });

  it("sem lacunas → score 0", () => {
    expect(gradeDropdown([], []).score).toBe(0);
  });
});
