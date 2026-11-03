// Projeto 13 — Fase 3: vocabulário utilizável diariamente (PRD §4.3).
// Filtro por união de fontes · limite da sessão · favoritos protegidos na poda
// · sentidos acumulados · reaprendizado (requeueCard) · draft leve da revisão
// · merge de backup do draft por startedAt.

import { beforeEach, describe, expect, it } from "vitest";

import type { TaskType } from "@/lib/pte";
import { mergeStates } from "@/lib/backup";
import {
  applyVocabStudy,
  sectionOfType,
  filterVocab,
  flattenVocab,
  MAX_VOCAB_ITEMS,
  pruneVocab,
  saveVocabPhrase,
  saveVocabWord,
  type VocabStore,
} from "@/lib/plus/vocab";
import { buildStudyQueue, requeueCard, type VocabStudyCard } from "@/lib/plus/vocabStudy";
import {
  clearVocabDraft,
  getVocabDraft,
  getStateSnapshot,
  saveVocabDraft,
  type AppState,
} from "@/lib/storage";

const T0 = 1_700_000_000_000;

function buildStore(): VocabStore {
  // "survey" traduzida em DUAS seções (speaking: read_aloud + writing: swt)
  // → união de fontes deve incluí-la nas duas.
  let store: VocabStore = { words: {}, phrases: {} };
  store = saveVocabWord(store, {
    word: "survey",
    literal: "pesquisa",
    contextual: "estudo por amostragem",
    source: { type: "read_aloud", qid: "ra:012" },
    ts: T0,
  });
  store = saveVocabWord(store, {
    word: "survey",
    literal: "pesquisa",
    source: { type: "swt", qid: "swt:001" },
    ts: T0 + 100,
  });
  store = saveVocabWord(store, {
    word: "rigorous",
    literal: "rigoroso",
    source: { type: "read_aloud", qid: "ra:012" },
    ts: T0 + 200,
  });
  store = saveVocabPhrase(store, {
    type: "read_aloud",
    qid: "ra:012",
    index: 0,
    en: "The survey covered households.",
    literal: "A pesquisa cobriu domicílios.",
    ts: T0 + 300,
  });
  return store;
}

const sectionsOf = (it: ReturnType<typeof flattenVocab>[number]): string[] => {
  const types =
    it.kind === "phrase" ? (it.type ? [it.type] : []) : [...new Set(it.sources.map((s) => s.type))];
  const out: string[] = [];
  for (const t of types as TaskType[]) {
    const sec = sectionOfType(t);
    if (sec && !out.includes(sec)) out.push(sec);
  }
  return out;
};

describe("proj13 fase 3 · seção por união de fontes", () => {
  it("palavra com fontes em duas seções aparece nas DUAS (união)", () => {
    const items = flattenVocab(buildStore());
    const survey = items.filter((it) => it.kind === "word" && it.en === "survey");
    expect(survey).toHaveLength(1);
    expect(sectionsOf(survey[0]!).sort()).toEqual(["speaking", "writing"]);
  });

  it("filtro de seção usa a união: 'survey' entra em speaking E writing", () => {
    const items = flattenVocab(buildStore());
    const speaking = filterVocab(items, { section: "speaking", now: T0, sectionsOf });
    const writing = filterVocab(items, { section: "writing", now: T0, sectionsOf });
    expect(speaking.map((i) => `${i.kind}:${i.en}`)).toContain("word:survey");
    expect(writing.map((i) => `${i.kind}:${i.en}`)).toContain("word:survey");
    // 'rigorous' só tem fonte speaking.
    expect(writing.map((i) => i.en)).not.toContain("rigorous");
  });
});

describe("proj13 fase 3 · sessão: escopo e limite", () => {
  it("fila parte dos itens passados (visíveis) e respeita o limite", () => {
    const items = flattenVocab(buildStore());
    const visible = filterVocab(items, { section: "writing", now: T0, sectionsOf });
    const qAll = buildStudyQueue(visible, { now: T0 });
    expect(qAll.length).toBe(visible.length);
    expect(qAll.every((c) => visible.some((v) => v.key === c.key && v.kind === c.kind))).toBe(true);

    const qLimited = buildStudyQueue(items, { now: T0, limit: 2 });
    expect(qLimited).toHaveLength(2);
  });

  it("requeueCard: 'não lembrei' volta ao fim UMA vez por item", () => {
    const [first] = buildStudyQueue(flattenVocab(buildStore()), { now: T0, limit: 2 });
    const card: VocabStudyCard = first!;
    let queue = buildStudyQueue(flattenVocab(buildStore()), { now: T0, limit: 2 });
    queue = requeueCard(queue, card);
    expect(queue).toHaveLength(3);
    expect(queue[queue.length - 1]).toMatchObject({ key: card.key, kind: card.kind });
    // segunda ocorrência não reagenda de novo
    expect(requeueCard(queue, card)).toHaveLength(3);
  });
});

describe("proj13 fase 3 · sentidos acumulados e favoritos na poda", () => {
  it("re-tradução com literal diferente acumula sentido e preserva o primeiro", () => {
    let store: VocabStore = { words: {}, phrases: {} };
    store = saveVocabWord(store, {
      word: "chart",
      literal: "gráfico",
      contextual: "em gráficos de linha",
      source: { type: "swt", qid: "swt:002" },
      ts: T0,
    });
    store = saveVocabWord(store, {
      word: "chart",
      literal: "mapear",
      source: { type: "swt", qid: "swt:003" },
      ts: T0 + 100,
    });
    const w = store.words["chart"]!;
    expect(w.literal).toBe("mapear");
    expect(w.senses).toHaveLength(1);
    expect(w.senses?.[0]?.literal).toBe("gráfico");
    expect(w.senses?.[0]?.contextual).toBe("em gráficos de linha");
  });

  it("pruneVocab protege favoritos: remove os mais antigos não favoritos", () => {
    let store: VocabStore = { words: {}, phrases: {} };
    const n = MAX_VOCAB_ITEMS + 5;
    for (let i = 0; i < n; i++) {
      store = saveVocabWord(store, {
        word: `word${String(i).padStart(3, "0")}`,
        literal: `w${i}`,
        source: { type: "read_aloud", qid: `ra:${i}` },
        ts: T0 + i,
      });
    }
    // favorita o item mais antigo
    store = {
      ...store,
      words: { ...store.words, word000: { ...store.words["word000"]!, starred: true } },
    };
    const pruned = pruneVocab(store, MAX_VOCAB_ITEMS);
    expect(pruned.words["word000"]).toBeDefined();
    const dropped = ["word001", "word002", "word003", "word004", "word005"].filter(
      (k) => pruned.words[k] === undefined,
    );
    expect(dropped.length).toBeGreaterThanOrEqual(1);
  });

  it("applyVocabStudy: 'não lembro' derruba a caixa e vence mais cedo", () => {
    let store: VocabStore = { words: {}, phrases: {} };
    store = saveVocabWord(store, {
      word: "rigorous",
      literal: "rigoroso",
      source: { type: "read_aloud", qid: "ra:012" },
      ts: T0,
    });
    store = applyVocabStudy(store, "word", "rigorous", false, T0 + 1_000);
    const w = store.words["rigorous"]!;
    expect(w.box).toBe(0);
    expect(w.dueAt).toBeLessThanOrEqual(T0 + 1_000);
  });
});

describe("proj13 fase 3 · draft leve da revisão", () => {
  beforeEach(() => {
    clearVocabDraft();
  });

  it("save/get/clear do draft com validação", () => {
    saveVocabDraft({
      startedAt: T0,
      queue: [
        { kind: "word", key: "survey" },
        { kind: "phrase", key: "ra:012:0" },
      ],
      index: 1,
      sim: 0,
      nao: 1,
      requeued: ["word:survey"],
    });
    const d = getVocabDraft();
    expect(d).not.toBeNull();
    expect(d?.index).toBe(1);
    expect(d?.queue).toHaveLength(2);
    expect(d?.requeued).toEqual(["word:survey"]);

    clearVocabDraft();
    expect(getVocabDraft()).toBeNull();
  });

  it("mergeStates: o draft mais recente vence no merge de backup", () => {
    const base: AppState = getStateSnapshot();
    const older: AppState = {
      ...base,
      vocabDraft: {
        startedAt: T0,
        queue: [{ kind: "word", key: "a" }],
        index: 0,
        sim: 0,
        nao: 0,
        requeued: [],
      },
    };
    const newer: AppState = {
      ...base,
      vocabDraft: {
        startedAt: T0 + 5_000,
        queue: [{ kind: "word", key: "b" }],
        index: 1,
        sim: 1,
        nao: 0,
        requeued: [],
      },
    };
    expect(mergeStates(older, newer)?.vocabDraft?.index).toBe(1);
    expect(mergeStates(newer, older)?.vocabDraft?.index).toBe(1);
    // sem draft em nenhum lado → null
    const none: AppState = { ...base, vocabDraft: null };
    expect(mergeStates(none, none)?.vocabDraft).toBeNull();
  });
});
