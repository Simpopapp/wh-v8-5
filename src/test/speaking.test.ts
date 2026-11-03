import { describe, expect, it } from "vitest";

import {
  cleanSpeakingText,
  gradeAnswerShort,
  gradeRepeatSentence,
  gradeRetell,
  parseAlternatives,
} from "@/lib/pte/speaking";

describe("cleanSpeakingText", () => {
  it("remove marcadores de repetição dos dados brutos", () => {
    expect(cleanSpeakingText("The budget will rise _(3 times)_ next year")).toBe(
      "The budget will rise next year",
    );
  });

  it("normaliza espaços e mantém texto limpo intacto", () => {
    expect(cleanSpeakingText("  hello   world  ")).toBe("hello world");
  });
});

describe("parseAlternatives", () => {
  it("separa alternativas com 'or'", () => {
    expect(parseAlternatives("autumn or fall")).toEqual(["autumn", "fall"]);
  });

  it("separa alternativas com '/' e vírgula", () => {
    expect(parseAlternatives("car / automobile, vehicle")).toEqual([
      "car",
      "automobile",
      "vehicle",
    ]);
  });

  it("retorna resposta única em lista", () => {
    expect(parseAlternatives("cheap")).toEqual(["cheap"]);
  });
});

describe("gradeAnswerShort", () => {
  it("aceita qualquer alternativa", () => {
    const g = gradeAnswerShort("autumn or fall", "fall");
    expect(g.correct).toBe(true);
    expect(g.matched).toBe("fall");
    expect(g.score).toBe(100);
  });

  it("aceita alternativa contida na transcrição", () => {
    const g = gradeAnswerShort("cheap", "the opposite is cheap i think");
    expect(g.correct).toBe(true);
    expect(g.matched).toBe("cheap");
  });

  it("ignora casing e pontuação", () => {
    const g = gradeAnswerShort("Cheap", "Cheap!");
    expect(g.correct).toBe(true);
  });

  it("marca como incorreta quando nada casa", () => {
    const g = gradeAnswerShort("autumn or fall", "spring");
    expect(g.correct).toBe(false);
    expect(g.matched).toBeNull();
    expect(g.score).toBe(0);
  });
});

describe("gradeRepeatSentence", () => {
  const sentence = "The library closes early on Friday";

  it("repetição perfeita rende score alto", () => {
    const g = gradeRepeatSentence(sentence, "The library closes early on Friday", 3000);
    expect(g.score).toBeGreaterThanOrEqual(90);
    expect(g.hits).toBe(6);
  });

  it("omite palavras → score menor e omissões marcadas", () => {
    const g = gradeRepeatSentence(sentence, "The library closes early", 2500);
    expect(g.hits).toBe(4);
    expect(g.score).toBeLessThan(100);
    expect(g.marks.filter((m) => m.status === "missed").length).toBe(2);
  });
});

describe("gradeRetell", () => {
  const lecture =
    "Solar panels convert sunlight into electricity using photovoltaic cells. The efficiency of solar panels depends on sunlight intensity and panel angle. Batteries store excess electricity for night use.";

  it("cobre keywords da palestra", () => {
    const g = gradeRetell(
      lecture,
      "Solar panels convert sunlight into electricity with photovoltaic cells and batteries store the rest",
      30000,
    );
    expect(g.gradable).toBe(true);
    expect(g.coverage).toBeGreaterThanOrEqual(50);
    expect(g.covered).toContain("solar");
    expect(g.covered).toContain("electricity");
    expect(g.score).toBeGreaterThan(0);
  });

  it("conta pausas e detecta repetições", () => {
    const g = gradeRetell(lecture, "um the solar solar panels", 8000, 2);
    expect(g.pauses).toBe(2);
    expect(g.repetitions).toBeGreaterThanOrEqual(1);
  });

  it("fala muito curta não é avaliável", () => {
    const g = gradeRetell(lecture, "solar", 1000);
    expect(g.gradable).toBe(false);
    expect(g.score).toBe(0);
  });
});
