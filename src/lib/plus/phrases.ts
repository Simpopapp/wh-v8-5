/** Tradução de frase do pack "studie-plus" (Fase 2, EN → pt-BR). */

/** Tradução de uma frase: literal + interpretativa (contexto geral). */
export interface PhraseTranslation {
  /** Tradução literal da frase (pt-BR). */
  l: string;
  /** Tradução interpretativa/contexual (opcional, ≤ 200 chars). */
  c?: string;
}

/** Entrada por questão: traduções alinhadas por índice de frase. */
export interface PhraseEntry {
  t: PhraseTranslation[];
}

/** Formato de `src/data/plus/phrases/{type}.json`: qid → entrada. */
export type PhraseData = Record<string, PhraseEntry>;

/**
 * Lookup por índice (mesma segmentação de `splitSentences`). Fora do arquivo,
 * índice inexistente ou entrada inválida → null (a UI mostra estado vazio,
 * nunca tradução errada).
 */
export function lookupPhrase(
  data: PhraseData,
  qid: string,
  index: number,
): PhraseTranslation | null {
  const entry = data[qid];
  if (!entry || !Array.isArray(entry.t)) return null;
  const t = entry.t[index];
  if (!t || typeof t.l !== "string" || t.l.trim() === "") return null;
  return typeof t.c === "string" && t.c.trim() !== "" ? { l: t.l, c: t.c } : { l: t.l };
}

/** Quantas frases traduzidas existem para uma questão (0 se nenhuma). */
export function phraseCount(data: PhraseData, qid: string): number {
  const entry = data[qid];
  if (!entry || !Array.isArray(entry.t)) return 0;
  return entry.t.filter((t) => t && typeof t.l === "string" && t.l.trim() !== "").length;
}
