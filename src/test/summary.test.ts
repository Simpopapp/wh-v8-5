import { describe, expect, it } from "vitest";

import { countSentences, extractKeywords, gradeSst, gradeSwt, wordZoneOf } from "@/lib/pte/summary";

const SOURCE =
  "Urban beekeeping has gained popularity in recent years, driven by concerns about declining wild bee populations and a renewed interest in local food production. Cities including New York, Paris and Melbourne now host thousands of hives, and municipal governments have created programs to support new beekeepers with training and public rooftop apiaries.";

describe("wordZoneOf", () => {
  it("classifica abaixo/dentro/acima da zona", () => {
    expect(wordZoneOf(3, 5, 75)).toBe("short");
    expect(wordZoneOf(40, 5, 75)).toBe("ok");
    expect(wordZoneOf(90, 5, 75)).toBe("long");
  });
});

describe("countSentences", () => {
  it("conta terminais . ! ?", () => {
    expect(countSentences("Uma frase simples.")).toBe(1);
    expect(countSentences("Uma. Duas! Tres?")).toBe(3);
    expect(countSentences("   ")).toBe(0);
  });
});

describe("extractKeywords", () => {
  it("exclui stopwords e prioriza frequência", () => {
    const kws = extractKeywords(SOURCE);
    expect(kws.length).toBeGreaterThan(0);
    expect(kws).not.toContain("the");
    expect(kws).toContain("beekeeping");
    expect(kws).toContain("bee");
  });
});

describe("gradeSwt", () => {
  it("resumo ideal em frase única dentro da zona", () => {
    const answer =
      "Although urban beekeeping has grown popular because of declining wild bee populations, cities like New York and Paris now support rooftop hives with municipal training programs for beekeepers.";
    const g = gradeSwt(SOURCE, answer);
    expect(g.singleSentence).toBe(true);
    expect(g.zone).toBe("ok");
    expect(g.coverage).toBeGreaterThanOrEqual(50);
    expect(g.connectives.length).toBeGreaterThan(0);
    expect(g.score).toBeGreaterThan(60);
  });

  it("penaliza múltiplas frases", () => {
    const multi = "Urban beekeeping is popular. Cities support hives with training programs.";
    const g = gradeSwt(SOURCE, multi);
    expect(g.singleSentence).toBe(false);
    expect(g.sentenceCount).toBe(2);
    const single = gradeSwt(
      SOURCE,
      "Urban beekeeping is popular and cities support hives with training programs.",
    );
    expect(single.score).toBeGreaterThan(g.score);
  });

  it("marca zona short/long fora de 5-75", () => {
    expect(gradeSwt(SOURCE, "Beekeeping rises.").zone).toBe("short");
    const long = Array.from({ length: 80 }, (_, i) => `word${i % 20}`).join(" ");
    expect(gradeSwt(SOURCE, long).zone).toBe("long");
  });

  it("resposta vazia zera o score", () => {
    const g = gradeSwt(SOURCE, "   ");
    expect(g.words).toBe(0);
    expect(g.zone).toBe("short");
    expect(g.score).toBe(0);
  });
});

describe("gradeSst", () => {
  const TRANSCRIPT =
    "The Human Rights Act can be seen as far reaching and controversial in the history of rights in the United Kingdom, yet it also provides a cautious starting point for wider protections. Courts must now interpret legislation compatibly with convention rights, and judges gained power to declare incompatibility when statutes conflict.";

  it("resumo de 60 palavras dentro da zona pontua bem", () => {
    const answer =
      "The lecture explains that the Human Rights Act remains both far reaching and deeply controversial in the modern United Kingdom history, while it also stays a very cautious starting point for wider legal protections today, since courts must now interpret legislation compatibly and judges may declare incompatibility when statutes conflict with convention rights.";
    const g = gradeSst(TRANSCRIPT, answer);
    expect(g.zone).toBe("ok");
    expect(g.coverage).toBeGreaterThan(30);
    expect(g.score).toBeGreaterThan(45);
  });

  it("resumo muito curto cai na zona short e perde pontos de zona", () => {
    const good = gradeSst(
      TRANSCRIPT,
      "The Human Rights Act can be seen as both far reaching and controversial in the long history of rights in the United Kingdom, yet it also provides a very cautious and measured starting point for further legal change, and courts must interpret legislation compatibly with convention rights while judges may declare incompatibility.",
    );
    const short = gradeSst(TRANSCRIPT, "The Act is controversial but important for rights.");
    expect(good.zone).toBe("ok");
    expect(short.zone).toBe("short");
    expect(short.score).toBeLessThan(good.score);
  });

  it("resumo de 90 palavras fica fora da zona próxima (long)", () => {
    const answer = Array.from({ length: 90 }, (_, i) => `point${i % 10}`).join(" ");
    const g = gradeSst(TRANSCRIPT, answer);
    expect(g.zone).toBe("long");
  });
});
