// Correção pura dos MCQs (Fase 5): escolha única e múltipla com saldo líquido.

import { describe, expect, it } from "vitest";

import { gradeMulti, gradeSingle } from "@/lib/pte/mcq";

describe("gradeSingle", () => {
  it("acerta a opção correta → 100", () => {
    const g = gradeSingle(2, [2]);
    expect(g.correct).toBe(true);
    expect(g.score).toBe(100);
    expect(g.answer).toBe(2);
  });

  it("errou a opção → 0, sem penalidade", () => {
    const g = gradeSingle(0, [2]);
    expect(g.correct).toBe(false);
    expect(g.score).toBe(0);
    expect(g.selected).toBe(0);
  });

  it("não respondeu → 0", () => {
    const g = gradeSingle(null, [1]);
    expect(g.correct).toBe(false);
    expect(g.score).toBe(0);
  });

  it("questão sem resposta normalizada (answer vazio) → nunca acerta", () => {
    const g = gradeSingle(0, []);
    expect(g.correct).toBe(false);
    expect(g.answer).toBe(-1);
  });
});

describe("gradeMulti", () => {
  it("marca todas as corretas → pontos cheios", () => {
    const g = gradeMulti([0, 2], [0, 2], 5);
    expect(g.raw).toBe(2);
    expect(g.score).toBe(100);
    expect(g.hits).toBe(2);
    expect(g.missed).toBe(0);
    expect(g.falsePositives).toBe(0);
    expect(g.marks[0]?.status).toBe("correct-picked");
    expect(g.marks[2]?.status).toBe("correct-picked");
    expect(g.marks[1]?.status).toBe("neutral");
  });

  it("marca correta + errada → saldo líquido 0 (mínimo aplicado)", () => {
    const g = gradeMulti([0, 1], [0, 2], 5);
    expect(g.hits).toBe(1);
    expect(g.falsePositives).toBe(1);
    expect(g.raw).toBe(0);
    expect(g.score).toBe(0);
    expect(g.marks[1]?.status).toBe("wrong-picked");
    expect(g.marks[2]?.status).toBe("correct-missed");
  });

  it("duas erradas e uma correta → mínimo 0, não negativo", () => {
    const g = gradeMulti([0, 1, 3], [0], 5);
    expect(g.hits).toBe(1);
    expect(g.falsePositives).toBe(2);
    expect(g.raw).toBe(0);
    expect(g.score).toBe(0);
  });

  it("marcou nada → 0 com as corretas faltando", () => {
    const g = gradeMulti([], [0, 2], 5);
    expect(g.raw).toBe(0);
    expect(g.missed).toBe(2);
    expect(g.marks[0]?.status).toBe("correct-missed");
  });

  it("duplicatas na seleção não contam duas vezes", () => {
    const g = gradeMulti([0, 0, 1], [0], 3);
    expect(g.hits).toBe(1);
    expect(g.falsePositives).toBe(1);
    expect(g.raw).toBe(0);
  });
});
