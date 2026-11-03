// Tipos unificados das questões PTE (22 task types / 4 seções).

export type Section = "speaking" | "writing" | "reading" | "listening";

export type TaskType =
  | "read_aloud"
  | "repeat_sentence"
  | "retell_lecture"
  | "answer_short"
  | "swt"
  | "write_essay"
  | "mcq_single"
  | "mcq_multi"
  | "reorder_paragraphs"
  | "read_fib"
  | "wfd"
  | "lst_fib"
  | "summarize_spoken_text"
  | "lst_hiw"
  | "lst_hcs"
  | "lst_summary"
  | "lst_smw"
  | "lst_mcq"
  | "lst_mcq_multi"
  // Fase 7 do projeto 9 — os 3 tipos do formato 2025 que faltavam.
  | "summarize_group_discussion"
  | "respond_to_situation"
  | "describe_image";

export const SECTION_ORDER: Section[] = ["speaking", "writing", "reading", "listening"];

export interface SectionMeta {
  label: string;
  description: string;
}

export const SECTION_META: Record<Section, SectionMeta> = {
  speaking: {
    label: "Speaking",
    description: "Leia, repita e responda em voz alta com correção palavra por palavra.",
  },
  writing: {
    label: "Writing",
    description: "Resuma textos em uma frase, ou escreva a redação completa de 200-300 palavras.",
  },
  reading: {
    label: "Reading",
    description:
      "Compreensão de leitura: escolha única/múltipla, reordenar parágrafos e lacunas com dropdown.",
  },
  listening: {
    label: "Listening",
    description: "Ditado, lacunas, discrepâncias e compreensão auditiva.",
  },
};

// Instrução padrão por tipo (Fase 5, D2): o JSON guarda uma única cópia quando o
// texto é igual para todo o tipo; o leitor (catalog.ts) preenche a partir daqui.
// Derivado do banco por scripts/slim — nunca exibir número fixo daqui.
export const DEFAULT_PROMPTS: Record<TaskType, string> = {
  read_aloud:
    "Look at the text below. In 40 seconds, you must read this text aloud as naturally and clearly as possible.",
  repeat_sentence: "Listen to the sentence and repeat it exactly.",
  retell_lecture: "Listen to the lecture and retell it in your own words in 40 seconds.",
  answer_short: "One word or short phrase. Don't elaborate.",
  swt: "ONE sentence, 5-75 words. Capture the main claim and the key supporting detail. Use a complex structure (although/while/despite).",
  write_essay: "",
  reorder_paragraphs: "Reordene os trechos para formar um parágrafo coerente.",
  read_fib: "Escolha a palavra correta para cada lacuna.",
  mcq_single:
    "Read the text and answer the multiple-choice question by selecting one correct response.",
  mcq_multi:
    "Read the text and answer the question by selecting all correct responses. More than one is correct.",
  wfd: "You will hear a sentence. Type the sentence in the box below exactly as you hear it.",
  lst_fib: "You will hear a recording. Type the missing words in the gaps.",
  summarize_spoken_text: "Listen to the lecture and write a summary of 50-70 words.",
  lst_hiw: "",
  lst_hcs: "",
  lst_summary: "",
  lst_smw: "",
  lst_mcq: "",
  lst_mcq_multi: "",
  // Fase 7 (projeto 9): instruções dos 3 tipos novos do formato 2025.
  // Tempos oficiais (Pearson, Test Tips V4 JUL 2025 e página de formato):
  // SGD = 10 s de preparo + 2 min de fala; RTS = 10 s de preparo + 40 s;
  // DI = 25 s para estudar a imagem + até 40 s de fala.
  summarize_group_discussion:
    "You will hear a discussion between three people. After listening, you will have 10 seconds to prepare and 2 minutes to give your response.",
  respond_to_situation:
    "You will hear a situation. After 10 seconds to prepare, respond in 40 seconds in your own words.",
  describe_image:
    "Look at the image. You have 25 seconds to study it and prepare your response, then speak for up to 40 seconds.",
};

export interface TypeMeta {
  label: string;
  section: Section;
  /** Motor de prática já implementado (senão a questão fica "em breve"). */
  ready: boolean;
}

export const TYPE_META: Record<TaskType, TypeMeta> = {
  read_aloud: { label: "Read Aloud", section: "speaking", ready: true },
  repeat_sentence: { label: "Repeat Sentence", section: "speaking", ready: true },
  retell_lecture: { label: "Retell Lecture", section: "speaking", ready: true },
  answer_short: { label: "Answer Short Question", section: "speaking", ready: true },
  swt: { label: "Summarize Written Text", section: "writing", ready: true },
  write_essay: { label: "Write Essay", section: "writing", ready: true },
  mcq_single: { label: "Reading MCQ · única", section: "reading", ready: true },
  mcq_multi: { label: "Reading MCQ · múltipla", section: "reading", ready: true },
  reorder_paragraphs: { label: "Re-order Paragraphs", section: "reading", ready: true },
  read_fib: { label: "Reading FIB · dropdown", section: "reading", ready: true },
  wfd: { label: "Write From Dictation", section: "listening", ready: true },
  lst_fib: { label: "Fill in the Blanks", section: "listening", ready: true },
  summarize_spoken_text: { label: "Summarize Spoken Text", section: "listening", ready: true },
  lst_hiw: { label: "Highlight Incorrect Words", section: "listening", ready: true },

  lst_hcs: { label: "Highlight Correct Summary", section: "listening", ready: true },
  lst_summary: { label: "Summarize the Audio", section: "listening", ready: true },
  lst_smw: { label: "Select Missing Word", section: "listening", ready: true },
  lst_mcq: { label: "Listening MCQ · única", section: "listening", ready: true },
  lst_mcq_multi: { label: "Listening MCQ · múltipla", section: "listening", ready: true },

  // Fase 7 (projeto 9): os 3 tipos do formato 2025, com motores próprios.
  summarize_group_discussion: {
    label: "Summarize Group Discussion",
    section: "speaking",
    ready: true,
  },
  respond_to_situation: { label: "Respond to a Situation", section: "speaking", ready: true },
  describe_image: { label: "Describe Image", section: "speaking", ready: true },
};

// ---------- Questão discriminada por taskType ----------

export type Difficulty = "easy" | "medium" | "hard";

export interface BaseQuestion {
  id: string;
  taskType: TaskType;
  section: Section;
  prompt: string;
  /** Texto principal exibido (passage, frase, transcrição). */
  text: string;
  /** Texto para TTS ("", quando a questão já é de leitura). */
  audioText: string;
  /** Transcrição falada esperada ("", quando não há fala). */
  transcript: string;
  wordCount: number;
  topic: string;
  source: string;
  /** Dificuldade informada pela fonte (quando existe). */
  difficulty?: Difficulty;
  /** Quantas vezes a frase apareceu em provas (fonte pte2-prediction). */
  examFrequency?: number;
}

export interface ReadAloudQuestion extends BaseQuestion {
  taskType: "read_aloud";
  gradingNotes: string;
}

export interface RepeatSentenceQuestion extends BaseQuestion {
  taskType: "repeat_sentence";
  answer: string;
  gradingNotes: string;
}

export interface RetellLectureQuestion extends BaseQuestion {
  taskType: "retell_lecture";
  gradingNotes: string;
}

export interface AnswerShortQuestion extends BaseQuestion {
  taskType: "answer_short";
  /** Pode conter alternativas: "autumn or fall". */
  answer: string;
  gradingNotes: string;
}

export interface SwtQuestion extends BaseQuestion {
  taskType: "swt";
  gradingNotes: string;
  sample: string;
}

export interface SstQuestion extends BaseQuestion {
  taskType: "summarize_spoken_text";
  gradingNotes: string;
  sample: string;
}

export interface WriteEssayQuestion extends BaseQuestion {
  taskType: "write_essay";
  gradingNotes: string;
  sample: string;
  /** Tipo de redação: Agree/Disagree, Discuss, Problem/Solution. */
  essayType: string;
  /** Vocabulário de alta faixa da resposta modelo. */
  vocabulary: string[];
}

export interface ReorderQuestion extends BaseQuestion {
  taskType: "reorder_paragraphs";
  /** Trechos na ordem embaralhada da fonte. */
  items: string[];
  /** Ordem correta: índices de `items` na sequência do parágrafo final. */
  correctOrder: number[];
}

export interface ReadFibQuestion extends BaseQuestion {
  taskType: "read_fib";
  /** Uma entrada por lacuna "______(k)", na ordem k. */
  blanks: { options: string[]; answer: string }[];
}

export interface DictationQuestion extends BaseQuestion {
  taskType: "wfd";
  answer: string;
  explanation: string;
}

export interface FibQuestion extends BaseQuestion {
  taskType: "lst_fib";
  /** Respostas na ordem das lacunas (tokens "_" no texto). */
  answers: string[];
  explanation: string;
  trap: string;
}

export interface HiwQuestion extends BaseQuestion {
  taskType: "lst_hiw";
  /** Índices das palavras erradas (ordem do texto). */
  errorIndexes: number[];
  explanation: string;
  trap: string;
}

export interface ChoiceQuestion extends BaseQuestion {
  taskType: "mcq_single" | "mcq_multi" | "lst_mcq" | "lst_mcq_multi" | "lst_hcs" | "lst_smw";
  options: string[];
  /** Índices corretos normalizados (string "2" → [2]; "" → []). */
  answer: number[];
  explanation: string;
  trap: string;
}

export interface SummaryChoiceQuestion extends BaseQuestion {
  taskType: "lst_summary";
  gradingNotes: string;
  sample: string;
}

/** Fase 7: discussão entre 3 pessoas — replay multi-voz + resumo falado de 2 min. */
export interface SgdQuestion extends BaseQuestion {
  taskType: "summarize_group_discussion";
  /** Frase de apresentação lida antes da discussão. */
  narration: string;
  /** Turnos na ordem original (voz/pitch deriva do índice do speaker). */
  turns: { speaker: string; text: string }[];
  sample: string;
}

/** Fase 7: situação do cotidiano — 10 s de preparo + 40 s de fala. */
export interface RespondSituationQuestion extends BaseQuestion {
  taskType: "respond_to_situation";
  sample: string;
}

/** Fase 7: gráfico CC BY (Our World in Data) — 25 s de preparo + 40 s de fala. */
export interface DescribeImageQuestion extends BaseQuestion {
  taskType: "describe_image";
  /** Slug do gráfico em src/assets/describe-image/ (resolve via describeImageAssets). */
  image: string;
  /** Texto alternativo acessível (o gráfico em palavras). */
  alt: string;
}

export type Question =
  | ReadAloudQuestion
  | RepeatSentenceQuestion
  | RetellLectureQuestion
  | AnswerShortQuestion
  | SwtQuestion
  | WriteEssayQuestion
  | ReorderQuestion
  | ReadFibQuestion
  | SstQuestion
  | DictationQuestion
  | FibQuestion
  | HiwQuestion
  | ChoiceQuestion
  | SummaryChoiceQuestion
  | SgdQuestion
  | RespondSituationQuestion
  | DescribeImageQuestion;

/** Tokeniza um texto em palavras (mesma regra do scoring legado). */
export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}
