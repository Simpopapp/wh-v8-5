// Fundação do vocabulário (projeto 10, Fase 1): funções puras + storage v7.
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_VOCAB_ITEMS,
  MAX_VOCAB_SOURCES,
  VOCAB_INTERVAL_DAYS,
  applyVocabStudy,
  emptyVocabStore,
  normalizeVocabStore,
  pruneVocab,
  saveVocabPhrase,
  saveVocabWord,
  removeVocabItem,
  toggleVocabStar,
  vocabCounts,
  vocabDueCount,
  vocabPhraseKey,
  vocabWordKey,
} from "@/lib/plus/vocab";
import { SRS_INTERVAL_DAYS } from "@/lib/storage";
import { lookupWord, type Glossary } from "@/lib/plus/glossary";

vi.setConfig({ testTimeout: 30_000 });

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

describe("vocab.ts — chaves e captura", () => {
  it("vocabWordKey casa com a normalização do lookup do glossário", () => {
    const glossary: Glossary = { rigorous: { literal: "rigoroso" } };
    // "Rigorous," e "rigorous" e "RIGOROUS" caem na MESMA chave/entrada
    expect(vocabWordKey("Rigorous,")).toBe("rigorous");
    expect(lookupWord(glossary, "Rigorous,")).toEqual({ literal: "rigoroso" });
    expect(lookupWord(glossary, vocabWordKey("RIGOROUS’"))).toEqual({ literal: "rigoroso" });
    expect(vocabWordKey("don’t")).toBe("don't");
  });

  it("palavra nova entra com caixa 0 (vencida) e fonte registrada", () => {
    let store = emptyVocabStore();
    store = saveVocabWord(store, {
      word: "Rigorous,",
      literal: "rigoroso",
      contextual: "usado em contextos acadêmicos",
      source: { type: "read_aloud", qid: "ra:012" },
      ts: T0,
    });
    expect(Object.keys(store.words)).toEqual(["rigorous"]);
    const w = store.words["rigorous"]!;
    expect(w.literal).toBe("rigoroso");
    expect(w.contextual).toBe("usado em contextos acadêmicos");
    expect(w.sources).toEqual([{ type: "read_aloud", qid: "ra:012" }]);
    expect(w.seenCount).toBe(1);
    expect(w.box).toBe(0);
    expect(w.dueAt).toBe(0);
    expect(vocabDueCount(store, T0)).toBe(1);
  });

  it("re-salvar a mesma palavra em OUTRA questão reconta o gesto e mescla fontes, sem zerar a caixa", () => {
    let store = emptyVocabStore();
    store = saveVocabWord(store, {
      word: "rigorous",
      literal: "rigoroso",
      source: { type: "read_aloud", qid: "ra:012" },
      ts: T0,
    });
    // estuda o item: caixa sobe
    store = applyVocabStudy(store, "word", "rigorous", true, T0);
    expect(store.words["rigorous"]!.box).toBe(1);
    expect(store.words["rigorous"]!.dueAt).toBe(T0 + 1 * DAY);
    // re-traduz em outra questão
    store = saveVocabWord(store, {
      word: "rigorous",
      literal: "rigoroso",
      source: { type: "swt", qid: "swt:034" },
      ts: T0 + 1000,
    });
    const w = store.words["rigorous"]!;
    expect(w.seenCount).toBe(2);
    expect(w.sources).toEqual([
      { type: "read_aloud", qid: "ra:012" },
      { type: "swt", qid: "swt:034" },
    ]);
    expect(w.box).toBe(1); // a captura NÃO mexe na caixa de estudo (D7)
    expect(w.lastSeenAt).toBe(T0 + 1000);
  });

  it("re-salvar a mesma fonte NÃO duplica a fonte", () => {
    let store = emptyVocabStore();
    store = saveVocabWord(store, {
      word: "rigorous",
      literal: "rigoroso",
      source: { type: "read_aloud", qid: "ra:012" },
      ts: T0,
    });
    store = saveVocabWord(store, {
      word: "rigorous",
      literal: "rigoroso",
      source: { type: "read_aloud", qid: "ra:012" },
      ts: T0 + 500,
    });
    expect(store.words["rigorous"]!.sources).toEqual([{ type: "read_aloud", qid: "ra:012" }]);
    expect(store.words["rigorous"]!.seenCount).toBe(2);
  });

  it("cap de fontes: ficam as MAX_VOCAB_SOURCES mais recentes", () => {
    let store = emptyVocabStore();
    for (let i = 0; i < 10; i++) {
      store = saveVocabWord(store, {
        word: "rigorous",
        literal: "rigoroso",
        source: { type: "read_aloud", qid: `ra:${String(i).padStart(3, "0")}` },
        ts: T0 + i,
      });
    }
    const w = store.words["rigorous"]!;
    expect(w.sources.length).toBe(MAX_VOCAB_SOURCES);
    expect(w.sources[0]!.qid).toBe("ra:004"); // as 4 mais antigas saíram
    expect(w.sources.at(-1)!.qid).toBe("ra:009");
  });

  it("entrada inválida (word/literal vazios) NÃO cria item — nada é inventado", () => {
    let store = emptyVocabStore();
    store = saveVocabWord(store, { word: "", literal: "x", ts: T0 });
    store = saveVocabWord(store, { word: "valid", literal: "  ", ts: T0 });
    expect(vocabCounts(store).words).toBe(0);
  });

  it("frase nova: chave type:qid#índice; entrada inválida sai", () => {
    let store = emptyVocabStore();
    store = saveVocabPhrase(store, {
      type: "read_aloud",
      qid: "ra:012",
      index: 2,
      en: "The survey covered households.",
      literal: "A pesquisa cobriu domicílios.",
      ts: T0,
    });
    expect(Object.keys(store.phrases)).toEqual([vocabPhraseKey("read_aloud", "ra:012", 2)]);
    const p = store.phrases[vocabPhraseKey("read_aloud", "ra:012", 2)]!;
    expect(p.en).toBe("The survey covered households.");
    expect(p.box).toBe(0);
    // inválidas: sem type/qid/índice/EN/literal
    store = saveVocabPhrase(store, { type: "", qid: "x", index: 0, en: "a", literal: "b", ts: T0 });
    store = saveVocabPhrase(store, {
      type: "ra",
      qid: "x",
      index: -1,
      en: "a",
      literal: "b",
      ts: T0,
    });
    store = saveVocabPhrase(store, {
      type: "ra",
      qid: "x",
      index: 0,
      en: "",
      literal: "b",
      ts: T0,
    });
    expect(vocabCounts(store).phrases).toBe(1);
  });

  it("removeVocabItem e toggleVocabStar: chave desconhecida → inalterado", () => {
    let store = emptyVocabStore();
    store = saveVocabWord(store, { word: "rigorous", literal: "rigoroso", ts: T0 });
    expect(toggleVocabStar(store, "word", "inexistente")).toBe(store);
    expect(removeVocabItem(store, "word", "inexistente")).toBe(store);
    store = toggleVocabStar(store, "word", "rigorous");
    expect(store.words["rigorous"]!.starred).toBe(true);
    store = removeVocabItem(store, "word", "rigorous");
    expect(vocabCounts(store).words).toBe(0);
  });

  it("applyVocabStudy: lembro sobe a caixa (teto 5), não lembro desce (piso 0)", () => {
    let store = emptyVocabStore();
    store = saveVocabPhrase(store, {
      type: "swt",
      qid: "swt:001",
      index: 0,
      en: "A.",
      literal: "B.",
      ts: T0,
    });
    const key = vocabPhraseKey("swt", "swt:001", 0);
    for (let i = 1; i <= 7; i++) store = applyVocabStudy(store, "phrase", key, true, T0 + i);
    expect(store.phrases[key]!.box).toBe(5);
    store = applyVocabStudy(store, "phrase", key, false, T0 + 8);
    expect(store.phrases[key]!.box).toBe(4);
    for (let i = 0; i < 6; i++) store = applyVocabStudy(store, "phrase", key, false, T0 + 9 + i);
    expect(store.phrases[key]!.box).toBe(0);
    // caixa 0 → vencida imediatamente (dueAt no momento da avaliação)
    expect(store.phrases[key]!.dueAt).toBeLessThanOrEqual(T0 + 14);
  });

  it("VOCAB_INTERVAL_DAYS é o espelho exato de SRS_INTERVAL_DAYS", () => {
    expect([...VOCAB_INTERVAL_DAYS]).toEqual([...SRS_INTERVAL_DAYS]);
  });
});

describe("vocab.ts — poda e normalização", () => {
  it("pruneVocab evapora os lastSeenAt mais antigos ao passar do teto", () => {
    let store = emptyVocabStore();
    for (let i = 0; i < 6; i++) {
      store = saveVocabWord(store, { word: `w${i}`, literal: `t${i}`, ts: T0 + i });
    }
    store = saveVocabPhrase(store, {
      type: "ra",
      qid: "q1",
      index: 0,
      en: "a",
      literal: "b",
      ts: T0 + 100,
    });
    // teto 4: ficam os 4 mais recentes (w2, w3, w4, w5) + não conta — total era 7
    const pruned = pruneVocab(store, 4);
    expect(vocabCounts(pruned).total).toBe(4);
    expect(pruned.words["w5"]).toBeDefined();
    expect(pruned.words["w0"]).toBeUndefined();
    expect(pruned.phrases[vocabPhraseKey("ra", "q1", 0)]).toBeDefined(); // mais recente fica
  });

  it("normalizeVocabStore descarta malformado, clampa caixa, dedupe chaves e poda fontes", () => {
    const raw = {
      words: {
        "Rigorous,": {
          word: "Rigorous,",
          literal: "rigoroso",
          box: 9,
          seenCount: 0,
          sources: [
            { type: "ra", qid: "1" },
            { type: "ra", qid: "1" }, // dedupe
            "lixo",
            { qid: "sem-type" },
            { type: "swt", qid: "2" },
          ],
        },
        "sem-literal": { literal: "   " },
        lixo: "string solta",
      },
      phrases: {
        "ra:q1#0": { type: "ra", qid: "q1", index: 0, en: "a", literal: "b", box: -3 },
        "ra:q2#x": { en: "sem literal" },
      },
      nonsense: true,
    };
    const norm = normalizeVocabStore(raw);
    expect(vocabCounts(norm).words).toBe(1);
    expect(vocabCounts(norm).phrases).toBe(1);
    const w = norm.words["rigorous"]!;
    expect(w.box).toBe(5); // clamp alto
    expect(w.seenCount).toBe(1); // mínimo 1
    expect(w.sources.length).toBe(2); // dedupe + itens inválidos fora
    expect(norm.phrases[vocabPhraseKey("ra", "q1", 0)]!.box).toBe(0); // clamp baixo
    expect(norm.words["sem-literal"]).toBeUndefined();
  });

  it("normalizeVocabStore(undefined) → vocabulário vazio (nunca undefined)", () => {
    expect(normalizeVocabStore(undefined)).toEqual({ words: {}, phrases: {} });
    expect(normalizeVocabStore(null)).toEqual({ words: {}, phrases: {} });
  });

  it("teto global MAX_VOCAB_ITEMS é 4000 (contrato do PRD)", () => {
    expect(MAX_VOCAB_ITEMS).toBe(4000);
  });
});

describe("storage v7 — migração e backup", () => {
  /** Estado v6 sintético sem vocabulário. */
  function v6Doc(vocab?: unknown) {
    return {
      version: 6,
      srsRules: 2,
      attempts: [
        {
          qid: "q1",
          ts: T0,
          taskType: "wfd",
          mode: "manual",
          contentScore: null,
          score: 95,
          wpm: null,
          durationMs: 8000,
        },
      ],
      questions: {},
      daily: {},
      bookmarks: ["q1"],
      notes: { q1: { text: "nota", updatedAt: T0 } },
      sessions: [],
      draft: null,
      ...(vocab !== undefined ? { vocabulary: vocab } : {}),
      settings: {},
    };
  }

  it("v6 sem vocabulário → v7 com vocabulário vazio; nada se perde", async () => {
    const storage = await import("@/lib/storage");
    const migrated = storage.migrateLegacyState(v6Doc());
    expect(migrated.version).toBe(7);
    expect(migrated.vocabulary).toEqual({ words: {}, phrases: {} });
    expect(migrated.bookmarks).toEqual(["q1"]);
    expect(migrated.notes["q1"]!.text).toBe("nota");
    expect(migrated.attempts.length).toBe(1);
  });

  it("v6 com vocabulário → v7 preserva os itens normalizados (idempotente)", async () => {
    const storage = await import("@/lib/storage");
    const vocab = {
      words: {
        rigorous: { word: "rigorous", literal: "rigoroso", savedAt: T0, box: 2, sources: [] },
      },
      phrases: {},
    };
    const first = storage.migrateLegacyState(v6Doc(vocab));
    expect(first.vocabulary.words["rigorous"]!.literal).toBe("rigoroso");
    expect(first.vocabulary.words["rigorous"]!.box).toBe(2);
    // idempotente: v7 re-migrado não muda
    const again = storage.migrateLegacyState(first);
    expect(again.vocabulary).toEqual(first.vocabulary);
    expect(again.version).toBe(7);
  });

  it("backup v7 exportado reimporta 1:1 (vocabulary incluído)", async () => {
    const storage = await import("@/lib/storage");
    storage.saveVocabWord({
      word: "rigorous",
      literal: "rigoroso",
      source: { type: "read_aloud", qid: "ra:012" },
      ts: T0,
    });
    storage.saveVocabPhrase({
      type: "swt",
      qid: "swt:001",
      index: 0,
      en: "A.",
      literal: "B.",
      ts: T0,
    });
    const json = storage.exportBackup();
    expect(JSON.parse(json).version).toBe(7);
    // estado limpo + import volta com os itens
    storage.replaceState({
      ...storage.migrateLegacyState({ version: 6, srsRules: 2, settings: {} }),
    });
    expect(vocabCounts(storage.getStateSnapshot().vocabulary).total).toBe(0);
    expect(storage.importBackup(json).ok).toBe(true);
    const after = storage.getStateSnapshot();
    expect(after.vocabulary.words["rigorous"]!.literal).toBe("rigoroso");
    expect(after.vocabulary.words["rigorous"]!.sources).toEqual([
      { type: "read_aloud", qid: "ra:012" },
    ]);
    expect(Object.keys(after.vocabulary.phrases)).toEqual([vocabPhraseKey("swt", "swt:001", 0)]);
  });

  it("backup v6 importado em v7: vocabulário vazio, resto intacto", async () => {
    const storage = await import("@/lib/storage");
    const result = storage.importBackup(JSON.stringify({ ...v6Doc(), app: "pte-master-hub" }));
    expect(result.ok).toBe(true);
    const state = storage.getStateSnapshot();
    expect(state.version).toBe(7);
    expect(state.vocabulary).toEqual({ words: {}, phrases: {} });
    expect(state.bookmarks).toEqual(["q1"]);
  });

  it("resetProgress preserva o vocabulário (D10)", async () => {
    const storage = await import("@/lib/storage");
    storage.saveVocabWord({ word: "rigorous", literal: "rigoroso", ts: T0 });
    storage.resetProgress();
    expect(storage.getStateSnapshot().vocabulary.words["rigorous"]).toBeDefined();
    expect(storage.getStateSnapshot().attempts).toEqual([]);
  });

  it("mescla de backup (mergeStates) une vocabulário: gesto mais recente vence, seenCount soma", async () => {
    const storage = await import("@/lib/storage");
    const backup = await import("@/lib/backup");
    const base = storage.migrateLegacyState({ version: 6, srsRules: 2, settings: {} });
    const cur = {
      ...base,
      vocabulary: {
        words: {
          rigorous: {
            word: "rigorous",
            literal: "antigo",
            savedAt: T0,
            lastSeenAt: T0,
            seenCount: 1,
            sources: [{ type: "read_aloud", qid: "ra:001" }],
            box: 1,
            dueAt: T0 + DAY,
            starred: false,
          },
        },
        phrases: {},
      },
    };
    const inc = {
      ...base,
      vocabulary: {
        words: {
          rigorous: {
            word: "rigorous",
            literal: "novo",
            savedAt: T0 + DAY,
            lastSeenAt: T0 + DAY,
            seenCount: 2,
            sources: [{ type: "swt", qid: "swt:001" }],
            box: 0,
            dueAt: 0,
            starred: true,
          },
        },
        phrases: {
          [vocabPhraseKey("ra", "q1", 0)]: {
            type: "ra",
            qid: "q1",
            index: 0,
            en: "a",
            literal: "b",
            savedAt: T0,
            lastSeenAt: T0,
            seenCount: 1,
            box: 0,
            dueAt: 0,
          },
        },
      },
    };
    const merged = backup.mergeStates(cur, inc);
    const w = merged.vocabulary.words["rigorous"]!;
    expect(w.literal).toBe("novo"); // gesto mais recente vence
    expect(w.seenCount).toBe(3); // gestos somam
    expect(w.sources.map((s) => s.qid)).toEqual(["ra:001", "swt:001"]);
    expect(w.box).toBe(1); // caixa mais avançada sobrevive
    expect(w.starred).toBe(true);
    expect(Object.keys(merged.vocabulary.phrases)).toEqual([vocabPhraseKey("ra", "q1", 0)]);
    expect(merged.version).toBe(7);
  });
});
