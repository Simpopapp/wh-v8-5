// Projeto 10, Fase 3 — área de vocabulário: achatamento, busca, filtros e ordenação.
import { describe, expect, it } from "vitest";

import {
  flattenVocab,
  filterVocab,
  saveVocabPhrase,
  saveVocabWord,
  type VocabStore,
} from "@/lib/plus/vocab";

const T0 = 1_700_000_000_000;
const now = T0 + 10_000;

function buildStore(): VocabStore {
  let store: VocabStore = { words: {}, phrases: {} };
  store = saveVocabWord(store, {
    word: "rigorous",
    literal: "rigoroso",
    contextual: "que exige precisão",
    source: { type: "read_aloud", qid: "ra:012" },
    ts: T0,
  });
  store = saveVocabWord(store, {
    word: "survey",
    literal: "pesquisa",
    source: { type: "swt", qid: "swt:001" },
    ts: T0 + 100,
  });
  store = saveVocabPhrase(store, {
    type: "read_aloud",
    qid: "ra:012",
    index: 0,
    en: "The survey covered households.",
    literal: "A pesquisa cobriu domicílios.",
    ts: T0 + 200,
  });
  return store;
}

describe("flattenVocab", () => {
  it("achata palavras e frases com kind, en, tradução, fontes e origem", () => {
    const items = flattenVocab(buildStore());
    expect(items.length).toBe(3);
    const phrase = items.find((i) => i.kind === "phrase")!;
    expect(phrase.en).toBe("The survey covered households.");
    expect(phrase.type).toBe("read_aloud");
    expect(phrase.qid).toBe("ra:012");
    expect(phrase.index).toBe(0);
    const word = items.find((i) => i.key === "rigorous")!;
    expect(word.sources).toEqual([{ type: "read_aloud", qid: "ra:012" }]);
  });
});

describe("filterVocab — busca", () => {
  const items = flattenVocab(buildStore());
  const sectionOf = (it: (typeof items)[number]) => {
    if (it.kind === "phrase" && it.type) return "speaking";
    const first = it.sources[0];
    return first ? "speaking" : undefined;
  };

  it("busca casa o texto EN e a tradução, case-insensitive, substring", () => {
    expect(filterVocab(items, { query: "rigor" }).map((i) => i.en)).toEqual(["rigorous"]);
    // "pesquisa" casa a palavra E a frase cuja tradução contém "pesquisa"
    expect(filterVocab(items, { query: "PESQUISA" }).map((i) => i.en)).toEqual([
      "The survey covered households.",
      "survey",
    ]);
    expect(filterVocab(items, { query: "domicílios" }).map((i) => i.en)).toEqual([
      "The survey covered households.",
    ]);
    expect(filterVocab(items, { query: "inexistente" })).toEqual([]);
  });

  it("filtro por tipo: palavras OU frases", () => {
    expect(filterVocab(items, { kind: "word" }).every((i) => i.kind === "word")).toBe(true);
    expect(filterVocab(items, { kind: "phrase" }).map((i) => i.en)).toEqual([
      "The survey covered households.",
    ]);
  });

  it("filtro por seção via sectionOf fornecido pela UI", () => {
    expect(filterVocab(items, { section: "speaking", sectionOf }).length).toBe(3);
    expect(filterVocab(items, { section: "listening", sectionOf })).toEqual([]);
  });

  it("favoritos: só itens marcados", () => {
    // sem marcados
    expect(filterVocab(items, { starredOnly: true })).toEqual([]);
    const store = buildStore();
    const starred = {
      ...store,
      words: {
        ...store.words,
        survey: { ...store.words["survey"]!, starred: true },
      },
    };
    expect(filterVocab(flattenVocab(starred), { starredOnly: true }).map((i) => i.en)).toEqual([
      "survey",
    ]);
  });

  it("ordenação: recentes, mais traduzidas, A–Z e para revisar", () => {
    expect(filterVocab(items, { sort: "recentes" }).map((i) => i.en)).toEqual([
      "The survey covered households.",
      "survey",
      "rigorous",
    ]);
    const store = buildStore();
    // survey traduzido 3× → primeiro em "mais traduzidas"
    const triple = {
      ...store,
      words: {
        ...store.words,
        survey: { ...store.words["survey"]!, seenCount: 3 },
      },
    };
    expect(filterVocab(flattenVocab(triple), { sort: "mais-traduzidas" }).map((i) => i.en)[0]).toBe(
      "survey",
    );
    expect(filterVocab(items, { sort: "a-z" }).map((i) => i.en)[0]).toBe("rigorous");
    // para revisar: caixa 0 (dueAt 0) primeiro
    expect(filterVocab(items, { sort: "para-revisar" }).map((i) => i.dueAt)).toEqual([0, 0, 0]);
  });

  it("combinação de filtros (query + kind + seção)", () => {
    const out = filterVocab(items, {
      query: "pesquisa",
      kind: "word",
      section: "speaking",
      sectionOf,
    });
    expect(out.map((i) => i.en)).toEqual(["survey"]);
  });
});
