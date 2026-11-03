// Estimativa de treino na escala oficial 10–90 (decisão D3, PRD §3.4).
// Mapeia a % interna (0–100) do treino para a escala da prova de forma linear:
// 10 = 0%, 90 = 100%. É uma ESTIMATIVA DE TREINO, rotulada — nunca "previsão
// de nota oficial".

/** Rótulo obrigatório de toda exibição da estimativa. */
export const ESTIMATE_LABEL = "estimativa de treino";

/** % interna (0–100) → escala 10–90, linear, arredondada, sempre dentro de 10–90. */
export function estimateSkill(pct: number): number {
  const clamped = Math.max(0, Math.min(100, pct));
  return Math.max(10, Math.min(90, Math.round(10 + clamped * 0.8)));
}

export type Confidence = "low" | "medium" | "high";

/** Confiança pelo n de tentativas com score: <10 baixa, <25 média, resto alta. */
export function confidenceFor(n: number): Confidence {
  if (n < 10) return "low";
  if (n < 25) return "medium";
  return "high";
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: "confiança baixa",
  medium: "confiança média",
  high: "confiança alta",
};
