import { describe, expect, it } from "vitest";

import { confidenceFor, estimateSkill, ESTIMATE_LABEL } from "@/lib/pte/estimate";
import { SKILL_CONTRIBUTIONS, SKILL_WEIGHTS, TASK_SKILLS, skillsFor } from "@/lib/pte/skillMatrix";
import { TYPE_META } from "@/lib/pte/types";

describe("estimateSkill (escala 10–90, D3)", () => {
  it("mapeia 0→10, 50→50 e 100→90", () => {
    expect(estimateSkill(0)).toBe(10);
    expect(estimateSkill(50)).toBe(50);
    expect(estimateSkill(100)).toBe(90);
  });

  it("é monotônica e limitada em 10–90", () => {
    let prev = 0;
    for (let p = 0; p <= 100; p++) {
      const e = estimateSkill(p);
      expect(e).toBeGreaterThanOrEqual(prev);
      expect(e).toBeGreaterThanOrEqual(10);
      expect(e).toBeLessThanOrEqual(90);
      prev = e;
    }
    expect(estimateSkill(-10)).toBe(10);
    expect(estimateSkill(150)).toBe(90);
  });

  it("rótulo obrigatório da estimativa", () => {
    expect(ESTIMATE_LABEL).toBe("estimativa de treino");
  });
});

describe("SKILL_WEIGHTS (derivados da matriz oficial — D10)", () => {
  it("soma 100 e reflete a contagem de contribuições (21 tarefas pontuadas)", () => {
    const sum = Object.values(SKILL_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(SKILL_CONTRIBUTIONS).toEqual({ speaking: 6, listening: 12, reading: 8, writing: 4 });
    expect(SKILL_WEIGHTS).toEqual({ speaking: 20, listening: 40, reading: 27, writing: 13 });
  });

  it("cobre todos os tipos do catálogo e mantém os mapeamentos-chave", () => {
    for (const t of Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]) {
      expect(skillsFor(t).length).toBeGreaterThan(0);
    }
    expect(skillsFor("wfd")).toEqual(["listening", "writing"]);
    expect(skillsFor("read_aloud")).toEqual(["speaking"]);
    expect(skillsFor("swt")).toEqual(["reading", "writing"]);
    // Answer Short Question pontua oficialmente só Listening, embora a seção
    // do catálogo seja Speaking (a prova fala a resposta, o score vai p/ Listening).
    expect(skillsFor("answer_short")).toEqual(["listening"]);
  });

  it("TASK_SKILLS cobre exatamente os tipos do catálogo", () => {
    expect(Object.keys(TASK_SKILLS).sort()).toEqual(Object.keys(TYPE_META).sort());
  });
});

describe("confidenceFor (n mínimo de tentativas com score)", () => {
  it("<10 baixa, <25 média, resto alta", () => {
    expect(confidenceFor(0)).toBe("low");
    expect(confidenceFor(9)).toBe("low");
    expect(confidenceFor(10)).toBe("medium");
    expect(confidenceFor(24)).toBe("medium");
    expect(confidenceFor(25)).toBe("high");
  });
});
