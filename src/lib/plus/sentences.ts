/**
 * Segmentação de frases do pack "studie-plus" (Fase 2 — tradução por frase).
 * Funções puras: sem I/O, determinísticas e testáveis. A MESMA segmentação é
 * usada pela UI (PlusPhraseCard) e pelo pipeline de geração
 * (.opencode/proj6-work/extract-sentences.mjs) — alinhamento por índice.
 */

/** Abreviações comuns que NÃO encerram frase (minúsculas, sem ponto final). */
const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "st",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "al",
  "ca",
  "cf",
  "no",
  "vol",
  "approx",
  "dept",
  "est",
  "fig",
  "inc",
  "ltd",
  "univ",
]);

/** Terminal punctuation: . ! ? (clusters e aspas/parênteses de fechamento). */
const SENTENCE_END = /[.!?]+["'\u2019\u201d)\]]*$/;

/**
 * Divide um texto em frases: termina em `.`, `!` ou `?` seguido de espaço +
 * início de nova frase (letra maiúscula, dígito ou abertura de citação).
 * Abreviações (set acima), iniciais de uma letra ("J.") e decimais ("3.5")
 * não quebram a frase. O texto original é preservado: a concatenação das
 * frases reproduz o texto (exceto espaços colapsados entre frases, que
 * pertencem ao início da frase seguinte).
 */
export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences: string[] = [];
  let start = 0;
  for (let i = 0; i < trimmed.length; i += 1) {
    // fim de cluster de pontuação
    if (!".!?".includes(trimmed[i] ?? "")) continue;
    let end = i;
    while (end + 1 < trimmed.length && ".!?".includes(trimmed[end + 1] ?? "")) end += 1;
    // aspas/parênteses de fechamento imediatamente depois
    while (end + 1 < trimmed.length && /["'\u2019\u201d)\]]/.test(trimmed[end + 1] ?? "")) end += 1;

    // precisa haver conteúdo depois (com espaço)
    let next = end + 1;
    while (next < trimmed.length && /\s/.test(trimmed[next] ?? "")) next += 1;
    if (next >= trimmed.length) break; // fim do texto: resto fecha a última frase

    const nextChar = trimmed[next] ?? "";
    const startsNewSentence = /[A-Z0-9"'\u2018\u201c(]/.test(nextChar) && !/\s/.test(nextChar);
    if (!startsNewSentence) continue;

    // guarda: abreviação, inicial de uma letra, decimal (ex.: 3.5)
    const before = trimmed.slice(start, i);
    const lastWord = (before.match(/([A-Za-z.]+)$/) ?? [])[1] ?? "";
    if (ABBREVIATIONS.has(lastWord.toLowerCase())) continue;
    if (/^[A-Za-z]$/.test(lastWord)) continue; // inicial ("J. Smith")
    if (nextChar >= "0" && nextChar <= "9" && trimmed[i - 1] !== " ") continue; // decimal/versão

    const sentence = trimmed.slice(start, end + 1).trim();
    if (sentence) sentences.push(sentence);
    start = next;
    i = next - 1;
  }
  const tail = trimmed.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/** Número de frases de um texto (0 para texto vazio). */
export function sentenceCount(text: string): number {
  return splitSentences(text).length;
}

/**
 * Substitui marcadores de lacuna do banco (`______(k)`) por `____` para
 * exibição/tradução — usado por Read FIB (extractor e UI usam a mesma
 * função, garantindo alinhamento por índice).
 */
export function stripBlanks(text: string): string {
  return text.replace(/_{5,}\(\d+\)/g, "____");
}
