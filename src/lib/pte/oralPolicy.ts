/**
 * Política oral UNIFICADA prática↔exame (projeto 13, D6): o mesmo item com a
 * mesma resposta produz o MESMO veredito nos dois contextos. Aqui vive a
 * espera pela finalização do ASR (450 ms pós-stop, como na prática), a
 * classificação de falha e a decisão gradável/não-gradável — funções puras,
 * sem React, consumidas por ReadAloudPractice e pelo SpeechWidget do exame.
 */

/** Falha classificada da resposta oral. */
export type OralFailure =
  | "permission" // microfone negado
  | "network" // serviço de reconhecimento falhou
  | "unsupported" // navegador sem ASR
  | "empty" // nada foi reconhecido
  | "not_gradable"; // transcrição insuficiente para o gradador

/** Entrada da política: tudo que prática e exame conseguem observar igualmente. */
export interface OralInput {
  /** O navegador suporta reconhecimento de voz? */
  supported: boolean;
  /** Erro do ASR (tipos do hook de reconhecimento). */
  error: "not-allowed" | "network" | "no-speech" | null;
  /** Transcrição final acumulada (já normalizada pelo hook). */
  transcript: string;
  durationMs: number;
  pauses: number;
}

export interface OralVerdict<T = unknown> {
  /** Score 0–100, ou null quando não há avaliação justa. */
  score: number | null;
  gradable: boolean;
  failure: OralFailure | null;
  /** Resultado completo do gradador (wpm, hits, …) quando avaliável. */
  grade: T | null;
}

/** Janela de finalização do ASR pós-stop (mesma da prática desde sempre). */
export const ORAL_FINALIZE_MS = 450;

/**
 * Para o reconhecimento e espera a janela de finalização — os resultados
 * finais que chegarem nesse intervalo ainda entram na transcrição. Reentrada
 * do submit é responsabilidade do chamador (bloquear antes de chamar).
 */
export function waitForOralFinalization(
  stop: () => void,
  delayMs = ORAL_FINALIZE_MS,
): Promise<void> {
  stop();
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Classifica a falha ANTES de gradar. Prioridade: permissão → rede → sem
 * suporte → transcrição vazia (`no-speech` sem texto é vazio, não técnico).
 */
export function classifyOralFailure(input: OralInput): OralFailure | null {
  if (!input.supported) return "unsupported";
  if (input.error === "not-allowed") return "permission";
  if (input.error === "network") return "network";
  if (!input.transcript.trim()) return "empty";
  return null;
}

/**
 * Veredito único: falha → score null SEM gradar; transcrição válida → o
 * gradador do task type decide; gradador com `gradable: false` → não
 * avaliável (score null, nunca 0 injusto). Score 0 é avaliável e entra.
 */
export function decideOralVerdict<T extends { score: number; gradable?: boolean }>(
  input: OralInput,
  grade: (transcript: string, durationMs: number, pauses: number) => T,
): OralVerdict<T> {
  const failure = classifyOralFailure(input);
  if (failure) return { score: null, gradable: false, failure, grade: null };
  const g = grade(input.transcript, input.durationMs, input.pauses);
  if (g.gradable === false)
    return { score: null, gradable: false, failure: "not_gradable", grade: null };
  return { score: g.score, gradable: true, failure: null, grade: g };
}

/** Causa do resultado do exame derivada do veredito (rotulagem honesta). */
export function causeOfVerdict(
  verdict: OralVerdict,
): "graded" | "technical" | "empty" | "not_gradable" {
  if (verdict.gradable) return "graded";
  const f = verdict.failure;
  return f === "permission" || f === "network" || f === "unsupported"
    ? "technical"
    : f === "empty"
      ? "empty"
      : "not_gradable";
}
