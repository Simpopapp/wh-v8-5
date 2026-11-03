// Correção pura de Re-order Paragraphs (fase 5).
// O PTE pontua pares adjacentes: cada par consecutivo do arranjo do usuário que
// também aparece (na mesma ordem) no parágrafo correto vale 1 ponto.

import type { ReorderQuestion } from "./types";

export interface ReorderGrade {
  /** Índices de `items` no arranjo do usuário. */
  order: number[];
  /** Pares adjacentes corretos (0 a n−1). */
  pairsCorrect: number;
  pairsTotal: number;
  /** 100 quando o parágrafo está completo e na ordem exata. */
  score: number;
  /** Ordem correta para exibição. */
  correctOrder: number[];
}

/** Pares adjacentes (a, b) de uma sequência. */
function adjacentPairs(seq: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < seq.length; i += 1) {
    const a = seq[i];
    const b = seq[i + 1];
    if (a !== undefined && b !== undefined) pairs.push([a, b]);
  }
  return pairs;
}

export function gradeReorder(
  userOrder: number[],
  correctOrder: number[],
  _question?: ReorderQuestion,
): ReorderGrade {
  const pairsTotal = Math.max(correctOrder.length - 1, 0);
  const correctSet = new Set(adjacentPairs(correctOrder).map(([a, b]) => `${a}-${b}`));
  const pairsCorrect = adjacentPairs(userOrder).filter(([a, b]) =>
    correctSet.has(`${a}-${b}`),
  ).length;
  const exact = userOrder.length === correctOrder.length && pairsCorrect === pairsTotal;
  return {
    order: [...userOrder],
    pairsCorrect,
    pairsTotal,
    score: pairsTotal === 0 ? 0 : exact ? 100 : Math.round((pairsCorrect / pairsTotal) * 90),
    correctOrder: [...correctOrder],
  };
}
