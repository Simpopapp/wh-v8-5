import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fluencyProxy, gradePassage } from "@/lib/scoring";
import { detectTemplate } from "@/lib/pte/templateDetector";
import { tokenize } from "@/lib/pte";

const passage =
  "The rapid expansion of urban areas requires careful planning and sustainable design.";
const words = tokenize(passage);
const perfect =
  "the rapid expansion of urban areas requires careful planning and sustainable design";

describe("B4 — extras e repetições entram no score (casos anotados)", () => {
  it("leitura perfeita permanece 100 (nada a descontar)", () => {
    const g = gradePassage(words, perfect, 6000);
    expect(g.score).toBe(100);
    expect(g.extras).toHaveLength(0);
    expect(g.repetitions).toBe(0);
  });

  it("2 extras: crédito 12 − 2×0,25 = 11,5 → 96 (antes seria 100)", () => {
    const g = gradePassage(words, `${perfect} today folks`, 6000);
    expect(g.extras).toEqual(["today", "folks"]);
    expect(g.score).toBe(96);
  });

  it("repetição imediata: 1 extra ('the') + 1 repetição → 12 − 0,25 − 0,1 = 97", () => {
    const g = gradePassage(words, `the ${perfect}`, 6000);
    expect(g.repetitions).toBe(1);
    expect(g.score).toBe(97);
  });

  it("muitas sobras nunca produzem score negativo (piso 0)", () => {
    const g = gradePassage(
      words,
      `${perfect} and then extra one two three four five six seven eight nine ten`,
      8000,
    );
    expect(g.score).toBeGreaterThanOrEqual(0);
  });

  it("gradable não muda com a nova fórmula", () => {
    const ok = gradePassage(words, perfect, 6000);
    const short = gradePassage(words, "the rapid", 4000);
    expect(ok.gradable).toBe(true);
    expect(short.gradable).toBe(false);
  });
});

describe("proxy de fluência (sempre rotulado como proxy na UI)", () => {
  it("sem pausas e ritmo ideal → 100", () => {
    expect(fluencyProxy(0, "ideal")).toBe(100);
  });
  it("cada pausa longa desconta 15", () => {
    expect(fluencyProxy(2, "ideal")).toBe(70);
  });
  it("ritmo fora da faixa desconta 20", () => {
    expect(fluencyProxy(0, "slow")).toBe(80);
    expect(fluencyProxy(0, "fast")).toBe(80);
  });
  it("piso 0", () => {
    expect(fluencyProxy(9, "fast")).toBe(0);
  });
});

describe("detector local de template (nunca muda o score — só rotula)", () => {
  it("resposta cheia de frases-modelo e repetição → likelyTemplate", () => {
    const templated = [
      "In today's world, technology plays an important role in education.",
      "It is undeniable that access to the internet changes how students learn.",
      "In today's world, technology plays an important role in education.",
      "It is undeniable that access to the internet changes how students learn.",
      "In today's world, technology plays an important role in education.",
    ].join(" ");
    const v = detectTemplate(templated);
    expect(v.likelyTemplate).toBe(true);
    expect(v.reasons.length).toBeGreaterThan(0);
  });

  it("resposta genuína não é sinalizada", () => {
    const genuine =
      "Governments should invest more in public transport because it reduces congestion and lowers emissions. " +
      "Cities that expand metro networks tend to see fewer cars during peak hours, which also improves air quality. " +
      "Rural bus routes deserve similar attention, since residents without cars often struggle to reach jobs and services.";
    const v = detectTemplate(genuine);
    expect(v.likelyTemplate).toBe(false);
  });

  it("resposta curta não avalia n-gramas (guarda contra falso positivo)", () => {
    const v = detectTemplate("In today's world, education matters a lot.");
    expect(v.likelyTemplate).toBe(false);
  });
});

describe("B6 — texto honesto sobre reconhecimento de voz", () => {
  const settingsSrc = readFileSync("src/routes/settings.tsx", "utf8");

  it("Ajustes divulgam que o reconhecimento pode usar serviço do navegador", () => {
    expect(settingsSrc).toContain("serviço do próprio navegador");
  });

  it("Ajustes não dizem mais 'nenhum servidor'", () => {
    expect(settingsSrc.toLowerCase()).not.toContain("nenhum servidor");
  });
});
