// Detector local (sem IA) de respostas-modelo/repetição — projeto 9, Fase 3.
// A Pearson pode enviar para revisão humana respostas sinalizadas como
// "template"; aqui o detector só rotula um aviso — NUNCA muda o score.
// Heurísticas (D13 do PRD): (a) n-gramas repetidos dentro da resposta;
// (b) inícios de sentença repetidos; (c) sobreposição com lista pequena e
// pública de frases-modelo genéricas.

export interface TemplateVerdict {
  likelyTemplate: boolean;
  reasons: string[];
}

/** Frases-modelo genéricas públicas e conhecidas — lista pequena e declarativa. */
const TEMPLATE_PHRASES = [
  "in today's world",
  "in this modern era",
  "in this contemporary world",
  "it is undeniable that",
  "it goes without saying",
  "every coin has two sides",
  "with the advent of",
  "in a nutshell",
  "last but not least",
  "in conclusion it can be said",
  "it can be concluded that",
  "it is pertinent to mention",
];

/** Respostas curtas demais não avaliam n-gramas/inícios (evita falso positivo). */
const MIN_WORDS = 25;
/** Tamanho do n-grama analisado. */
const NGRAM = 4;
/** Um n-grama repetido 2× não condena; a partir de 3× sim. */
const NGRAM_REPEAT_FLAG = 3;
/** N-gramas distintos repetidos que caracterizam template. */
const NGRAM_FLAG_COUNT = 2;
/** Inícios de sentença idênticos (3 primeiras palavras) que caracterizam repetição. */
const START_FLAG_COUNT = 3;
/** Nº de frases-modelo distintas que caracteriza template. */
const PHRASE_FLAG_COUNT = 2;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function detectTemplate(answer: string): TemplateVerdict {
  const reasons: string[] = [];
  const toks = words(answer);

  if (toks.length >= MIN_WORDS) {
    // (a) n-gramas repetidos dentro da própria resposta.
    const grams = new Map<string, number>();
    for (let i = 0; i + NGRAM <= toks.length; i++) {
      const g = toks.slice(i, i + NGRAM).join(" ");
      grams.set(g, (grams.get(g) ?? 0) + 1);
    }
    let repeated = 0;
    for (const c of grams.values()) if (c >= NGRAM_REPEAT_FLAG) repeated += 1;
    if (repeated >= NGRAM_FLAG_COUNT) {
      reasons.push("expressões de 4+ palavras repetidas dentro da própria resposta");
    }

    // (b) inícios de sentença repetidos.
    const starts = new Map<string, number>();
    for (const sentence of answer.split(/[.!?]+/)) {
      const w = words(sentence).slice(0, 3);
      if (w.length === 3) {
        const key = w.join(" ");
        starts.set(key, (starts.get(key) ?? 0) + 1);
      }
    }
    for (const c of starts.values()) {
      if (c >= START_FLAG_COUNT) {
        reasons.push("muitas frases começando com as mesmas palavras");
        break;
      }
    }
  }

  // (c) sobreposição com frases-modelo genéricas.
  const lower = ` ${words(answer).join(" ")} `;
  let phraseHits = 0;
  for (const p of TEMPLATE_PHRASES) {
    if (lower.includes(` ${p} `)) phraseHits += 1;
  }
  if (phraseHits >= PHRASE_FLAG_COUNT) {
    reasons.push("usa frases-modelo genéricas decoradas (ex.: “In today’s world…”)");
  }

  return { likelyTemplate: reasons.length > 0, reasons };
}
