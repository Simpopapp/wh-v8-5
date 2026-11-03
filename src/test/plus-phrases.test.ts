import { describe, expect, it } from "vitest";

import { lookupPhrase, phraseCount } from "@/lib/plus/phrases";
import { sentenceCount, splitSentences, stripBlanks } from "@/lib/plus/sentences";

describe("splitSentences", () => {
  it("divide por . ! ? seguido de maiúscula", () => {
    expect(splitSentences("First one. Second one! Third?")).toEqual([
      "First one.",
      "Second one!",
      "Third?",
    ]);
  });

  it("abreviações não quebram a frase", () => {
    expect(splitSentences("The study, e.g. the pilot, was small. It ended early.")).toEqual([
      "The study, e.g. the pilot, was small.",
      "It ended early.",
    ]);
    expect(splitSentences("Dr. Silva spoke. Then Prof. Lee replied.")).toEqual([
      "Dr. Silva spoke.",
      "Then Prof. Lee replied.",
    ]);
  });

  it("inicial de uma letra e decimal não quebram", () => {
    expect(splitSentences("J. Smith scored 3.5 points. He improved.")).toEqual([
      "J. Smith scored 3.5 points.",
      "He improved.",
    ]);
  });

  it("aspas de fechamento pertencem à frase", () => {
    expect(splitSentences('He said "Go." She left.')).toEqual(['He said "Go."', "She left."]);
  });

  it("texto sem pontuação final vira uma frase", () => {
    expect(splitSentences("no punctuation here")).toEqual(["no punctuation here"]);
  });

  it("texto vazio → []", () => {
    expect(splitSentences("   ")).toEqual([]);
  });

  it("minúscula após ponto não quebra (mantém na mesma frase)", () => {
    expect(splitSentences("costs 2.5 m.illion? no")).toHaveLength(1);
  });
});

describe("sentenceCount", () => {
  it("conta frases", () => {
    expect(sentenceCount("One. Two! Three?")).toBe(3);
    expect(sentenceCount("")).toBe(0);
  });
});

describe("stripBlanks", () => {
  it("substitui ______(k) por ____", () => {
    expect(stripBlanks("The ______(1) grew and ______(2) fell.")).toBe(
      "The ____ grew and ____ fell.",
    );
  });
});

describe("lookupPhrase", () => {
  const data = {
    q1: { t: [{ l: "Primeira frase." }, { l: "Segunda.", c: "sentido figurado" }] },
    q2: { t: [{ l: "" }] },
  };

  it("hit por qid e índice", () => {
    expect(lookupPhrase(data, "q1", 0)).toEqual({ l: "Primeira frase." });
    expect(lookupPhrase(data, "q1", 1)).toEqual({ l: "Segunda.", c: "sentido figurado" });
  });

  it("literal vazia → null", () => {
    expect(lookupPhrase(data, "q2", 0)).toBeNull();
  });

  it("qid/índice fora → null", () => {
    expect(lookupPhrase(data, "q3", 0)).toBeNull();
    expect(lookupPhrase(data, "q1", 5)).toBeNull();
    expect(lookupPhrase(data, "", 0)).toBeNull();
  });
});

describe("phraseCount", () => {
  const countData = {
    q1: { t: [{ l: "Primeira frase." }, { l: "Segunda.", c: "sentido figurado" }] },
    q2: { t: [{ l: "" }] },
  };
  it("conta apenas entradas válidas", () => {
    expect(phraseCount(countData, "q1")).toBe(2);
    expect(phraseCount(countData, "q2")).toBe(0);
    expect(phraseCount(countData, "zz")).toBe(0);
  });
});
