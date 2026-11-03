// Projeto 10, Fase 4 — estudo: fila de flashcards e aplicação lembro/não lembro.
import { describe, expect, it } from "vitest";

import { applyVocabStudy, type VocabListItem, type VocabStore } from "@/lib/plus/vocab";
import { buildStudyQueue } from "@/lib/plus/vocabStudy";

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;
const now = T0 + 100 * DAY;

function item(
  extra: Partial<VocabListItem> & { en: string; kind: "word" | "phrase" },
): VocabListItem {
  return {
    key: extra.en,
    literal: "tradução",
    savedAt: T0,
    lastSeenAt: T0,
    seenCount: 1,
    box: 0,
    dueAt: 0,
    sources: [],
    ...extra,
  };
}

describe("buildStudyQueue — ordem da fila", () => {
  const items: VocabListItem[] = [
    // descansado (fora de revisão — vence no futuro)
    item({
      kind: "word",
      en: "descansada",
      box: 3,
      dueAt: now + 90 * DAY,
      lastSeenAt: T0 + 60 * DAY,
    }),
    // favorito vencido mais tarde
    item({ kind: "word", en: "fav-vencida", box: 1, dueAt: now - DAY, starred: true }),
    // vencidas
    item({ kind: "word", en: "vencida-1", box: 0, dueAt: T0 + 5 * DAY, lastSeenAt: T0 + 5 * DAY }),
    item({ kind: "phrase", en: "vencida-frase", box: 0, dueAt: T0 + 4 * DAY }),
    item({ kind: "word", en: "vencida-0", box: 0, dueAt: 0, lastSeenAt: T0 }),
    // favorito descansado (vence no futuro, mas aparece antes dos não marcados)
    item({ kind: "phrase", en: "fav-descansada", box: 2, dueAt: now + 80 * DAY, starred: true }),
  ];

  it("vencidos primeiro (mais vencido primeiro), depois favoritos, depois demais", () => {
    const q = buildStudyQueue(items, { now });
    expect(q.map((c) => c.en)).toEqual([
      "vencida-0", // dueAt 0 = mais vencido
      "vencida-frase",
      "vencida-1",
      "fav-vencida",
      "fav-descansada",
      "descansada",
    ]);
  });

  it("intercala palavra e frase nos vencidos (não vira bloco só de palavras)", () => {
    const q = buildStudyQueue(items, { now });
    // vencidos: word(0d), phrase(4d), word(5d) — ordenados por dueAt e intercalados
    expect(q.slice(0, 3).map((c) => c.kind)).toEqual(["word", "phrase", "word"]);
  });

  it("respeita o limite da sessão", () => {
    const q = buildStudyQueue(items, { now, limit: 2 });
    expect(q.map((c) => c.en)).toEqual(["vencida-0", "vencida-frase"]);
  });
});

describe("applyVocabStudy (puro) — caixa sobe/desce e dueAt", () => {
  function storeFixture(box: number): VocabStore {
    return {
      words: {
        w1: {
          word: "rigorous",
          literal: "rigoroso",
          savedAt: T0,
          lastSeenAt: T0,
          seenCount: 1,
          box,
          dueAt: now,
          sources: [],
        },
      },
      phrases: {
        p1: {
          en: "kept pace",
          literal: "acompanhou o ritmo",
          savedAt: T0,
          lastSeenAt: T0,
          seenCount: 1,
          box,
          dueAt: now,
          type: "read_aloud",
          qid: "ra:001",
          index: 0,
        },
      },
    };
  }

  it("lembro: caixa +1 e dueAt = ts + intervalo da caixa nova", () => {
    const out = applyVocabStudy(storeFixture(2), "word", "w1", true, now);
    const w = out.words["w1"]!;
    expect(w.box).toBe(3);
    expect(w.dueAt).toBe(now + 7 * DAY); // caixa 3 → 7 dias
    // frase não muda
    expect(out.phrases["p1"]!.box).toBe(2);
  });

  it("não lembro: caixa −1 (piso 0) e dueAt da caixa resultante", () => {
    const out = applyVocabStudy(storeFixture(1), "phrase", "p1", false, now);
    const p = out.phrases["p1"]!;
    expect(p.box).toBe(0);
    expect(p.dueAt).toBe(now + 0); // caixa 0 → vencida imediatamente
  });

  it("lembro no teto: caixa 5 → 30 dias", () => {
    const out = applyVocabStudy(storeFixture(5), "word", "w1", true, now);
    expect(out.words["w1"]!.box).toBe(5);
    expect(out.words["w1"]!.dueAt).toBe(now + 30 * DAY);
  });
});
