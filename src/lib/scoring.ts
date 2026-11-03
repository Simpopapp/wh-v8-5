export type WordStatus = "hit" | "missed" | "substituted" | "moved";

export interface WordMark {
  word: string;
  status: WordStatus;
}

export type PaceVerdict = "slow" | "ideal" | "fast";

export interface GradeResult {
  marks: WordMark[];
  extras: string[];
  hits: number;
  moved: number;
  total: number;
  score: number; // 0–100
  wpm: number;
  durationMs: number;
  paceVerdict: PaceVerdict;
  mastered: boolean;
  /** false quando a transcrição é curta demais para avaliar (evita 0% injusto). */
  gradable: boolean;
  transcript: string;
  pauses: number;
  repetitions: number;
}

export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/[^a-z0-9']/g, "")
    .replace(/'/g, "");
}

const FILLERS = new Set(["uh", "um", "er", "ah", "hmm", "eh", "mmm"]);

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length]!;
}

/** Substituição plausível: distância ≤2 para palavras longas, ≤1 para médias, nenhuma para curtas. */
function canSubstitute(a: string, b: string): boolean {
  if (a === b) return false;
  const minLen = Math.min(a.length, b.length);
  const maxDist = minLen >= 5 ? 2 : minLen >= 3 ? 1 : 0;
  if (maxDist === 0) return false;
  if (Math.abs(a.length - b.length) > maxDist + 1) return false;
  return levenshtein(a, b) <= maxDist;
}

const WEIGHT_HIT = 1;
const WEIGHT_SUBSTITUTED = 0.6;
const WEIGHT_MOVED = 0.5;
const GAP_COST = -0.5;
const MISMATCH_COST = -0.9;
/** B4: cada palavra dita fora do passage desconta crédito do score. */
export const EXTRA_PENALTY = 0.25;
/** B4: cada repetição imediata (palavra/bigrama) desconta crédito do score. */
export const REPETITION_PENALTY = 0.1;

/** Conta repetições: palavra repetida em sequência ou bigrama repetido imediatamente. */
export function countRepetitions(tokens: string[]): number {
  let reps = 0;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) {
      reps += 1;
      continue;
    }
    if (i >= 3 && tokens[i] === tokens[i - 2] && tokens[i - 1] === tokens[i - 3]) reps += 1;
  }
  return reps;
}

interface Alignment {
  /** Para cada palavra do passage, o índice dito correspondente (ou null). */
  pairJ: (number | null)[];
  matchedSaid: boolean[];
}

/** Alinhamento global (Needleman-Wunsch) entre passage e transcrição. */
function align(p: string[], s: string[]): Alignment {
  const n = p.length;
  const m = s.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const from: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    dp[i]![0] = i * GAP_COST;
    from[i]![0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    dp[0]![j] = j * GAP_COST;
    from[0]![j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const a = p[i - 1]!;
      const b = s[j - 1]!;
      const pairScore =
        a === b ? WEIGHT_HIT : canSubstitute(a, b) ? WEIGHT_SUBSTITUTED : MISMATCH_COST;
      const diag = dp[i - 1]![j - 1]! + pairScore;
      const up = dp[i - 1]![j]! + GAP_COST;
      const left = dp[i]![j - 1]! + GAP_COST;
      let best = diag;
      let dir = 0;
      if (up > best) {
        best = up;
        dir = 1;
      }
      if (left > best) {
        best = left;
        dir = 2;
      }
      dp[i]![j] = best;
      from[i]![j] = dir;
    }
  }

  const pairJ: (number | null)[] = new Array(n).fill(null);
  const matchedSaid = new Array<boolean>(m).fill(false);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const dir = i === 0 ? 2 : j === 0 ? 1 : from[i]![j]!;
    if (dir === 0) {
      pairJ[i - 1] = j - 1;
      matchedSaid[j - 1] = true;
      i -= 1;
      j -= 1;
    } else if (dir === 1) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return { pairJ, matchedSaid };
}

export interface GradeOptions {
  /** Pausas longas detectadas pelo reconhecimento (vazios entre trechos finais). */
  pauses?: number;
}

/**
 * Correção de conteúdo com ordem: alinha a transcrição ao passage e marca cada
 * palavra como lida no lugar (hit), omitida (missed), substituída por palavra
 * parecida (substituted) ou certa mas fora de ordem (moved, crédito parcial).
 */
export function gradePassage(
  passageWords: string[],
  transcript: string,
  durationMs: number,
  opts?: GradeOptions,
): GradeResult {
  const cleanTranscript = transcript.replace(/\s+/g, " ").trim();
  const said = cleanTranscript
    .toLowerCase()
    .split(/\s+/)
    .map((w) => normalizeWord(w))
    .filter((w) => w.length > 0 && !FILLERS.has(w));

  const norms = passageWords.map(normalizeWord);
  const { pairJ, matchedSaid } = align(norms, said);

  const saidAfterMismatch: string[] = [];
  const marks: WordMark[] = passageWords.map((word, i) => {
    const j = pairJ[i];
    if (j == null) return { word, status: "missed" };
    const saidWord = said[j]!;
    if (saidWord === norms[i]) return { word, status: "hit" };
    if (canSubstitute(norms[i]!, saidWord)) return { word, status: "substituted" };
    saidAfterMismatch.push(saidWord);
    return { word, status: "missed" };
  });

  // Palavras ditas que não renderam crédito: sobras do alinhamento + pares desalinhados.
  const extras = [...said.filter((_, j) => !matchedSaid[j]), ...saidAfterMismatch];

  // Palavra certa fora de ordem: foi dita, mas o alinhamento a colocou noutra posição.
  let moved = 0;
  for (const mark of marks) {
    if (mark.status !== "missed") continue;
    const k = extras.indexOf(normalizeWord(mark.word));
    if (k >= 0) {
      mark.status = "moved";
      extras.splice(k, 1);
      moved += 1;
    }
  }

  const hits = marks.filter((mk) => mk.status === "hit").length;
  const substituted = marks.filter((mk) => mk.status === "substituted").length;
  const total = passageWords.length;
  const repetitions = countRepetitions(said);
  // B4: o que sobra (extras/repetições) agora desconta do score de conteúdo.
  const credit = hits + WEIGHT_SUBSTITUTED * substituted + WEIGHT_MOVED * moved;
  const penalized = credit - EXTRA_PENALTY * extras.length - REPETITION_PENALTY * repetitions;
  const score = total > 0 ? Math.max(0, Math.round((penalized / total) * 100)) : 0;
  const minutes = durationMs / 60000;
  const wpm = minutes > 0.05 ? Math.round(said.length / minutes) : 0;
  const paceVerdict: PaceVerdict = wpm === 0 || wpm < 120 ? "slow" : wpm > 160 ? "fast" : "ideal";

  const minWords = Math.max(3, Math.ceil(total * 0.15));
  const gradable = said.length >= minWords;
  const mastered = gradable && score >= 90 && wpm >= 120 && wpm <= 160;
  const pauses = Math.max(0, Math.floor(opts?.pauses ?? 0));

  return {
    marks,
    extras,
    hits,
    moved,
    total,
    score,
    wpm,
    durationMs,
    paceVerdict,
    mastered,
    gradable,
    transcript: cleanTranscript,
    pauses,
    repetitions,
  };
}

export function paceLabel(verdict: PaceVerdict): string {
  switch (verdict) {
    case "slow":
      return "Ritmo arrastado — leia com mais fluidez";
    case "fast":
      return "Ritmo acelerado — respire e articule";
    default:
      return "Ritmo ideal para o PTE";
  }
}

/**
 * Proxy de fluência (Fase 3 — sempre rotulado como "proxy" na UI): parte de 100,
 * desconta 15 por pausa longa e 20 se o ritmo sai da faixa ideal. NÃO mede
 * fluência real — a Web Speech API não expõe prosódia.
 */
export function fluencyProxy(pauses: number, verdict: PaceVerdict): number {
  const pacePenalty = verdict === "ideal" ? 0 : 20;
  return Math.max(0, Math.min(100, 100 - Math.max(0, pauses) * 15 - pacePenalty));
}
