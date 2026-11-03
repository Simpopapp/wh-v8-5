import { describe, expect, it } from "vitest";

import { lookupWord } from "@/lib/plus/glossary";
import { splitWords } from "@/lib/plus/words";

describe("splitWords", () => {
  it("preserva pontuação e espaços byte a byte", () => {
    const text = "Hello, world! It\u2019s a test.";
    const { lead, tokens } = splitWords(text);
    const rebuilt = lead + tokens.map((t) => t.core + t.trail).join("");
    expect(rebuilt).toBe(text);
  });

  it("núcleo sem pontuação para lookup", () => {
    const { tokens } = splitWords("World, economic\u2019 forum.");
    expect(tokens.map((t) => t.core)).toEqual(["World", "economic\u2019", "forum"]);
    expect(tokens[0]?.trail).toContain(",");
  });

  it("texto vazio", () => {
    expect(splitWords("")).toEqual({ lead: "", tokens: [] });
  });

  it("última palavra guarda o que vem depois dela", () => {
    const { tokens } = splitWords("End.");
    expect(tokens[0]?.trail).toBe(".");
  });
});

describe("lookupWord", () => {
  const glossary = {
    world: { literal: "mundo" },
    reading: { literal: "leitura", contextual: "substantivo; também gerúndio de read" },
    "don't": { literal: "não faça" },
  };

  it("hit exato", () => {
    expect(lookupWord(glossary, "world")).toEqual({ literal: "mundo" });
  });

  it("case e pontuação externa são normalizados", () => {
    expect(lookupWord(glossary, "World,")).toEqual({ literal: "mundo" });
    expect(lookupWord(glossary, "READING")).toEqual({
      literal: "leitura",
      contextual: "substantivo; também gerúndio de read",
    });
  });

  it("apóstrofo tipográfico é normalizado para o formato do glossário", () => {
    expect(lookupWord(glossary, "don\u2019t")).toEqual({ literal: "não faça" });
  });

  it("miss → null (estado vazio, nunca tradução errada)", () => {
    expect(lookupWord(glossary, "economies")).toBeNull();
    expect(lookupWord(glossary, "  ")).toBeNull();
  });

  it("glossário vazio → null", () => {
    expect(lookupWord({}, "world")).toBeNull();
  });
});
