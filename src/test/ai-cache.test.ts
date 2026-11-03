import { describe, expect, it } from "vitest";

import {
  AI_CACHE_KEY,
  AI_CACHE_LIMITS,
  cachePrune,
  emptyAiCache,
  getPhrase,
  getWord,
  hashKey,
  loadAiCache,
  phraseCacheKey,
  putPhrase,
  putWord,
  saveAiCache,
  wordCacheKey,
} from "@/lib/plus/aiCache";
import type { AiPhraseResult, AiWordResult } from "@/lib/plus/aiSchemas";

const wordResult: AiWordResult = {
  word: "scarce",
  literal: "escasso",
  inSentence: { translation: "escasso aqui", why: "falta de água" },
  synonym: { common: "rare", verdict: "right", explanation: "também caberia" },
};

const phraseResult: AiPhraseResult = {
  translation: "Boa sorte hoje!",
  tips: [{ term: "break a leg", note: "não é literal" }],
};

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    store,
  };
}

describe("hashKey", () => {
  it("é determinístico e sensível à entrada", () => {
    expect(hashKey("scarce")).toBe(hashKey("scarce"));
    expect(hashKey("scarce")).not.toBe(hashKey("scarse"));
  });

  it("tem vetores fixos (FNV-1a 32 bits)", () => {
    expect(hashKey("")).toBe("811c9dc5");
    expect(hashKey("a")).toBe("e40c292c");
  });
});

describe("chaves de cache", () => {
  it("mesma palavra em frases distintas → chaves distintas", () => {
    expect(wordCacheKey("scarce", "Water is scarce.")).not.toBe(
      wordCacheKey("scarce", "Scarce time remains."),
    );
    expect(wordCacheKey("scarce", "Water is scarce.")).toBe(
      wordCacheKey("Scarce", "Water is scarce."),
    );
  });

  it("frase: o tipo entra na chave", () => {
    expect(phraseCacheKey("swt", "Same sentence.")).not.toBe(
      phraseCacheKey("wfd", "Same sentence."),
    );
    expect(phraseCacheKey("swt", "A.")).toBe(phraseCacheKey("swt", "A."));
  });
});

describe("cache em memória", () => {
  it("put/get de palavra e frase", () => {
    let state = emptyAiCache();
    const wk = wordCacheKey("scarce", "Water is scarce.");
    const pk = phraseCacheKey("swt", "Water is scarce.");
    state = putWord(state, wk, wordResult);
    state = putPhrase(state, pk, phraseResult);
    expect(getWord(state, wk)).toEqual(wordResult);
    expect(getPhrase(state, pk)).toEqual(phraseResult);
    expect(getWord(state, "w:missing::deadbeef")).toBeNull();
  });

  it("LRU despeja as entradas mais antigas nos limites", () => {
    let state = emptyAiCache();
    const keys: string[] = [];
    for (let i = 0; i < AI_CACHE_LIMITS.words + 10; i++) {
      const key = `w:k${i}::deadbeef`;
      keys.push(key);
      state = putWord(state, key, { ...wordResult, word: `k${i}` });
    }
    expect(Object.keys(state.words)).toHaveLength(AI_CACHE_LIMITS.words);
    expect(getWord(state, keys[0]!)).toBeNull();
    expect(getWord(state, keys[keys.length - 1]!)).not.toBeNull();
  });

  it("prune de frases usa o limite próprio", () => {
    let state = emptyAiCache();
    for (let i = 0; i < AI_CACHE_LIMITS.phrases + 5; i++) {
      state = putPhrase(state, `p:t::${i}`, phraseResult);
    }
    expect(Object.keys(state.phrases)).toHaveLength(AI_CACHE_LIMITS.phrases);
  });
});

describe("persistência", () => {
  it("round-trip via storage falso", () => {
    const storage = fakeStorage();
    let state = emptyAiCache();
    state = putWord(state, wordCacheKey("scarce", "S."), wordResult);
    saveAiCache(state, storage);
    expect(getWord(loadAiCache(storage), wordCacheKey("scarce", "S."))).toEqual(wordResult);
  });

  it("JSON inválido → cache vazio, sem lançar", () => {
    const storage = fakeStorage({ [AI_CACHE_KEY]: "{quebrado" });
    expect(loadAiCache(storage)).toEqual(emptyAiCache());
  });

  it("versão diferente → recomeço vazio", () => {
    const storage = fakeStorage({
      [AI_CACHE_KEY]: JSON.stringify({ version: 99, words: {}, phrases: {} }),
    });
    expect(loadAiCache(storage)).toEqual(emptyAiCache());
  });

  it("setItem bloqueado (modo privado) não propaga erro", () => {
    expect(() =>
      saveAiCache(emptyAiCache(), {
        setItem: () => {
          throw new Error("quota");
        },
      }),
    ).not.toThrow();
  });
});
