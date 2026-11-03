// Correção pura (testável) para MCQs — Fase 5: Reading (mcq_single/mcq_multi)
// e Listening (lst_mcq/lst_mcq_multi/lst_hcs/lst_smw).

// ---------- Escolha única ----------

export interface McqSingleGrade {
  correct: boolean;
  selected: number | null;
  answer: number;
  /** 100 (acertou) ou 0 (errou/não respondeu). */
  score: number;
}

/** Escolha única no PTE não tem penalidade: 1 ponto pela opção certa. */
export function gradeSingle(selected: number | null, answers: number[]): McqSingleGrade {
  const answer = answers[0] ?? -1;
  const correct = selected !== null && selected === answer;
  return { correct, selected, answer, score: correct ? 100 : 0 };
}

// ---------- Múltipla escolha (saldo líquido) ----------

export type McqOptionStatus = "correct-picked" | "correct-missed" | "wrong-picked" | "neutral";

export interface McqOptionMark {
  index: number;
  status: McqOptionStatus;
}

export interface McqMultiGrade {
  marks: McqOptionMark[];
  hits: number;
  missed: number;
  falsePositives: number;
  answerCount: number;
  /** Pontuação do exame: acertos − marcas erradas, mínimo 0. */
  raw: number;
  /** Percentual (0-100) para o histórico/dashboard. */
  score: number;
}

/** Múltipla escolha: +1 por correta marcada, −1 por errada marcada, mínimo 0. */
export function gradeMulti(
  selected: number[],
  answers: number[],
  optionCount: number,
): McqMultiGrade {
  const picked = new Set(selected);
  const answerSet = new Set(answers);
  const marks: McqOptionMark[] = Array.from({ length: optionCount }, (_, i): McqOptionMark => ({
    index: i,
    status: answerSet.has(i)
      ? picked.has(i)
        ? "correct-picked"
        : "correct-missed"
      : picked.has(i)
        ? "wrong-picked"
        : "neutral",
  }));
  const hits = marks.filter((m) => m.status === "correct-picked").length;
  const falsePositives = marks.filter((m) => m.status === "wrong-picked").length;
  const answerCount = answerSet.size;
  const raw = Math.max(0, hits - falsePositives);
  const score = answerCount > 0 ? Math.round((raw / answerCount) * 100) : 0;
  return {
    marks,
    hits,
    missed: answerCount - hits,
    falsePositives,
    answerCount,
    raw,
    score,
  };
}
