import type { Question } from "@/lib/pte/types";

/**
 * Campos de texto que o pack "studie-plus" pode oferecer áudio de pronúncia.
 * A matriz campo × task type garante a regra central do planejamento: o pack
 * NUNCA duplica o áudio nativo do mesmo campo.
 */
export type PlusAudioField =
  | "text" // passage/texto principal
  | "prompt" // enunciado
  | "sample" // resposta modelo
  | "answer" // resposta esperada (gabarito, pós-resultado)
  | "options" // alternativas de MCQ
  | "items" // trechos do Re-order
  | "explanation" // explicação/exam tip
  | "gradingNotes" // dicas do examinador
  | "transcript"; // campo NATIVO exclusivo (nunca do pack)

/**
 * Campos de áudio NATIVO por task type — o campo que o próprio motor já fala
 * (TTS do modelo, transcrição de listening, ditado). O pack nunca oferta
 * áudio para estes campos.
 */
const NATIVE_AUDIO_FIELDS: Partial<Record<string, PlusAudioField[]>> = {
  read_aloud: ["text"], // o motor lê o passage como modelo (quando não é modo manual)
  repeat_sentence: ["text", "transcript"],
  retell_lecture: ["text", "transcript"],
  answer_short: ["text", "transcript"],
  wfd: ["answer"], // ditado: o áudio nativo é a própria frase
  lst_fib: ["text", "transcript"],
  lst_hiw: ["text", "transcript"],
  lst_hcs: ["text", "transcript"],
  lst_summary: ["text", "transcript"],
  lst_smw: ["text", "transcript"],
  lst_mcq: ["text", "transcript"],
  lst_mcq_multi: ["text", "transcript"],
  summarize_spoken_text: ["text", "transcript"],
};

/** Campos que o pack oferta, por task type (excluindo os nativos acima). */
const PACK_AUDIO_FIELDS: Partial<Record<string, PlusAudioField[]>> = {
  read_aloud: [], // passage = áudio nativo; nada mais é falado
  repeat_sentence: ["answer"],
  retell_lecture: [],
  answer_short: ["answer"],
  swt: ["text", "sample"],
  write_essay: ["prompt", "text", "sample", "gradingNotes"],
  mcq_single: ["text", "options", "explanation"],
  mcq_multi: ["text", "options", "explanation"],
  reorder_paragraphs: ["items", "text"],
  read_fib: ["text"],
  wfd: ["answer", "explanation"], // resposta/explicação são campos vizinhos, pós-resultado
  lst_fib: ["explanation"],
  lst_hiw: ["explanation"],
  lst_hcs: ["options", "explanation"],
  lst_summary: ["sample"],
  lst_smw: ["options", "explanation"],
  lst_mcq: ["options", "explanation"],
  lst_mcq_multi: ["options", "explanation"],
  summarize_spoken_text: ["sample"],
};

/**
 * true quando o pack pode oferecer o botão "ouvir" para `field` nesta questão.
 * Regras:
 * 1. Campo com áudio nativo → false (nunca duplica).
 * 2. Campo fora da matriz do tipo → false.
 * 3. Texto vazio/sem conteúdo → false (nada para falar).
 */
export function plusAudioFor(question: Question, field: PlusAudioField, text?: string): boolean {
  if (typeof text === "string" && !text.trim()) return false;
  if (field === "transcript") return false; // transcrição é gabarito falado: nunca
  const native = NATIVE_AUDIO_FIELDS[question.taskType] ?? [];
  if (native.includes(field)) return false;
  const pack = PACK_AUDIO_FIELDS[question.taskType] ?? [];
  return pack.includes(field);
}

/** Lista os campos com áudio do pack para uma questão (ordem estável). */
export function plusAudioFields(question: Question): PlusAudioField[] {
  const native = NATIVE_AUDIO_FIELDS[question.taskType] ?? [];
  const pack = PACK_AUDIO_FIELDS[question.taskType] ?? [];
  return pack.filter((f) => !native.includes(f));
}

/** Texto a falar para um campo da questão (normaliza listas). */
export function plusAudioText(question: Question, field: PlusAudioField): string {
  switch (field) {
    case "options":
      return (question as { options?: string[] }).options?.join(". ") ?? "";
    case "items":
      return (question as { items?: string[] }).items?.join(" ") ?? "";
    case "answer": {
      const a = (question as { answer?: unknown }).answer;
      return typeof a === "string" ? a : "";
    }
    case "sample":
      return (question as { sample?: string }).sample ?? "";
    case "prompt":
      return question.prompt || question.text;
    case "explanation":
      return (question as { explanation?: string }).explanation ?? "";
    case "gradingNotes":
      return (question as { gradingNotes?: string }).gradingNotes ?? "";
    case "text":
      return question.text;
    default:
      return "";
  }
}
