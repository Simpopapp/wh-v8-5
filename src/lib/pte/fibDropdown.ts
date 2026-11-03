// Correção pura de Reading FIB (dropdown) — fase 5.
// Cada lacuna correta vale 1 ponto; score = acertos / total de lacunas.

import type { ReadFibQuestion } from "./types";

export interface DropdownGrade {
  /** Resposta escolhida por lacuna (null = em branco). */
  selections: (string | null)[];
  /** Índices das lacunas corretas. */
  correctIndexes: number[];
  correct: number;
  total: number;
  score: number;
}

export function gradeDropdown(
  selections: (string | null)[],
  blanks: ReadFibQuestion["blanks"],
): DropdownGrade {
  const correctIndexes: number[] = [];
  for (let i = 0; i < blanks.length; i += 1) {
    if (selections[i] !== null && selections[i] === blanks[i]?.answer) correctIndexes.push(i);
  }
  const total = blanks.length;
  return {
    selections: [...selections],
    correctIndexes,
    correct: correctIndexes.length,
    total,
    score: total === 0 ? 0 : Math.round((correctIndexes.length / total) * 100),
  };
}
