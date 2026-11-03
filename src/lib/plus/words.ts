/** Um token de palavra para render fiel: núcleo (lookup) + pontuação à direita. */
export interface WordToken {
  /** Palavra sem pontuação externa (base para lookup no glossário). */
  core: string;
  /** Texto entre o fim desta palavra e o início da próxima (pontuação + espaço). */
  trail: string;
}

/** Resultado da segmentação: texto antes da 1ª palavra + tokens. */
export interface SplitWordsResult {
  lead: string;
  tokens: WordToken[];
}

const WORD_RE = /[\p{L}][\p{L}'\u2019-]*/gu;

/**
 * Segmenta um texto em palavras preservando a pontuação original para render.
 * `lead` contém o texto antes da primeira palavra e o `trail` de cada token o
 * que vem depois dele (vírgulas, espaços, quebras de linha) — a concatenação
 * lead + core + trail reproduz o texto original byte a byte.
 */
export function splitWords(text: string): SplitWordsResult {
  if (!text) return { lead: "", tokens: [] };
  const matches = [...text.matchAll(WORD_RE)];
  if (matches.length === 0) return { lead: text, tokens: [] };
  const tokens: WordToken[] = matches.map((m, i) => {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const nextStart = i + 1 < matches.length ? (matches[i + 1]?.index ?? text.length) : text.length;
    return { core: m[0], trail: text.slice(end, nextStart) };
  });
  return { lead: text.slice(0, matches[0]?.index ?? 0), tokens };
}
