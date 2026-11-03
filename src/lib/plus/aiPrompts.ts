/**
 * Builders puros de prompt e foco por tipo de questão (PRD projeto 11, §2.4).
 * Sem rede, sem segredos: todo o comportamento é coberto por teste de unidade.
 */
import type { ModelMessage } from "ai";

import { AI_LIMITS, type AiPhraseResult, type AiWordResult } from "@/lib/plus/aiSchemas";

/** 22 task types — tabela em src/lib/pte/types.ts:102. */
export const TASK_TYPES = [
  "read_aloud",
  "repeat_sentence",
  "retell_lecture",
  "answer_short",
  "swt",
  "write_essay",
  "mcq_single",
  "mcq_multi",
  "reorder_paragraphs",
  "read_fib",
  "wfd",
  "lst_fib",
  "summarize_spoken_text",
  "lst_hiw",
  "lst_hcs",
  "lst_summary",
  "lst_smw",
  "lst_mcq",
  "lst_mcq_multi",
  "summarize_group_discussion",
  "respond_to_situation",
  "describe_image",
] as const;
export type AiTaskType = (typeof TASK_TYPES)[number];

export interface TypeFocus {
  /** O que o modelo recebe como contexto além da frase alvo. */
  context: string;
  /** Instrução de tradução específica do tipo. */
  focus: string;
}

const FOCUS: Record<AiTaskType, TypeFocus> = {
  read_aloud: {
    context: "passagem lida em voz alta",
    focus:
      "tradução natural para leitura em voz alta; em palavras, note entonação e palavras ligadas",
  },
  repeat_sentence: {
    context: "passagem que o aluno repete",
    focus: "tradução natural e fluida para memorização auditiva",
  },
  retell_lecture: {
    context: "trecho de transcrição de aula",
    focus: "registro falado; priorize gírias e expressões orais nas dicas",
  },
  answer_short: {
    context: "pergunta curta de resposta única",
    focus: "tradução pragmática: o que a pergunta espera como resposta",
  },
  swt: {
    context: "texto acadêmico a ser resumido em uma frase",
    focus: "registro acadêmico; distinção entre palavra técnica e uso comum",
  },
  write_essay: {
    context: "enunciado de redação",
    focus: "registro acadêmico; vocabulário que fortalece argumentação",
  },
  mcq_single: {
    context: "enunciado com alternativas de múltipla escolha",
    focus:
      "tradução fiel SEM sugerir qual alternativa está correta; dicas podem apontar armadilhas de vocabulário entre as opções",
  },
  mcq_multi: {
    context: "enunciado com alternativas de múltipla escolha (mais de uma correta)",
    focus:
      "tradução fiel SEM sugerir quais alternativas estão corretas; dicas podem apontar armadilhas de vocabulário entre as opções",
  },
  reorder_paragraphs: {
    context: "parágrafos a serem ordenados",
    focus: "conectores discursivos e coesão: o que justifica a posição do trecho na ordem",
  },
  read_fib: {
    context: "texto com lacunas marcadas como [lacuna]",
    focus:
      "tradução respeita as posições de lacuna; dicas explicam o tipo de palavra que a lacuna pede",
  },
  wfd: {
    context: "frase ditada (transcrição exata esperada)",
    focus: "transcrição exata; em palavras, atenção a homófonos e pluralização",
  },
  lst_fib: {
    context: "segmentos de áudio com lacunas marcadas como [lacuna]",
    focus:
      "tradução respeita as posições de lacuna; dicas explicam o tipo de palavra que a lacuna pede",
  },
  summarize_spoken_text: {
    context: "transcrição de áudio a ser resumida",
    focus: "registro falado; expressões idiomáticas e orais nas dicas",
  },
  lst_hiw: {
    context: "transcrição com palavras destacáveis (o aluno marca as erradas)",
    focus: "diferenças sutis entre palavras parecidas — o que o tipo testa",
  },
  lst_hcs: {
    context: "áudio com resumos alternativos para escolher",
    focus: "tradução fiel SEM sugerir qual resumo está correto",
  },
  lst_summary: {
    context: "transcrição de áudio a ser resumida",
    focus: "registro falado; expressões idiomáticas e orais nas dicas",
  },
  lst_smw: {
    context: "áudio com palavra final a ser escolhida entre opções",
    focus:
      "tradução fiel SEM revelar a palavra correta; dicas podem explicar o campo semântico em jogo",
  },
  lst_mcq: {
    context: "áudio com alternativas de múltipla escolha (única correta)",
    focus: "tradução fiel SEM sugerir qual alternativa está correta",
  },
  lst_mcq_multi: {
    context: "áudio com alternativas de múltipla escolha (mais de uma correta)",
    focus: "tradução fiel SEM sugerir quais alternativas estão corretas",
  },
  summarize_group_discussion: {
    context: "transcrição de discussão em grupo",
    focus: "registro falado de múltiplos interlocutores; expressões coloquiais nas dicas",
  },
  respond_to_situation: {
    context: "situação a ser respondida em fala",
    focus: "tradução pragmática: o que a situação pede do falante",
  },
  describe_image: {
    context: "texto descritivo de imagem/gráfico",
    focus: "vocabulário de dados e tendências (aumenta, cai, mantém-se)",
  },
};

export const AI_TYPE_FOCUS: Record<AiTaskType, TypeFocus> = FOCUS;

export const AI_FALLBACK_FOCUS: TypeFocus = {
  context: "texto de estudo",
  focus: "tradução natural e fiel",
};

export function focusForType(taskType: string): TypeFocus {
  return (FOCUS as Record<string, TypeFocus>)[taskType] ?? AI_FALLBACK_FOCUS;
}

const INSTRUCTIONS = [
  "Você é um assistente de tradução didático EN→português do Brasil para alunos de PTE.",
  "Responda SEMPRE com JSON válido no schema pedido, em português do Brasil,",
  "sem inventar conteúdo que não esteja no texto fornecido.",
  "Se a questão for de múltipla escolha, a tradução jamais sugere a alternativa correta.",
].join(" ");

/** Substitui sequências de underscore (lacunas do banco) por marca legível. */
export function markBlanks(sentence: string): string {
  return sentence
    .replace(/_{2,}(?:\(\d+\))?/g, "[lacuna]")
    .replace(/\(\d+\)(?=\s|$)/g, "")
    .trim();
}

function contextBlock(input: { taskType: string; questionText?: string | undefined }): string {
  const focus = focusForType(input.taskType);
  const parts = [
    `Tipo de questão: ${input.taskType} (${focus.context}).`,
    `Foco de tradução: ${focus.focus}.`,
  ];
  if (input.questionText && input.questionText.trim()) {
    parts.push(`Contexto da questão: ${input.questionText.trim()}`);
  }
  return parts.join("\n");
}

/** Modelo A — prompt do card de palavra. */
export function buildWordPrompt(input: {
  word: string;
  sentence: string;
  questionText?: string | undefined;
  taskType: string;
}): { instructions: string; messages: ModelMessage[] } {
  const content = [
    contextBlock(input),
    `Frase: ${markBlanks(input.sentence)}`,
    `Palavra alvo: ${input.word}`,
    "",
    `Produza um objeto JSON exatamente com estes campos:`,
    `- word: a palavra alvo (mínuscula, sem pontuação);`,
    `- literal: significado literal da palavra (máx. ${AI_LIMITS.literal} caracteres);`,
    `- inSentence.translation: o que a palavra significa NESTA frase (máx. ${AI_LIMITS.inSentenceTranslation});`,
    `- inSentence.why: por que ela foi usada nesse contexto e não outra (máx. ${AI_LIMITS.inSentenceWhy});`,
    `- synonym.common: o sinônimo comum mais provável para a palavra fora de contexto (máx. ${AI_LIMITS.synonymCommon});`,
    `- synonym.verdict: avaliar o uso do sinônimo comum nesta frase, um de "wrong" (ficaria errado), "right" (também estaria certo) ou "mcnc" (estaria certo, porém menos cabível neste contexto);`,
    `- synonym.explanation: por que o autor preferiu a palavra usada em vez do sinônimo (máx. ${AI_LIMITS.synonymExplanation}).`,
    "Nada além do que o texto fornece; não use conhecimento externo sobre a questão.",
  ].join("\n");
  return { instructions: INSTRUCTIONS, messages: [{ role: "user", content }] };
}

/** Modelo B — prompt do card de frase. */
export function buildPhrasePrompt(input: {
  sentence: string;
  taskType: string;
  questionText?: string | undefined;
  options?: string[] | undefined;
  neighbors?: string[] | undefined;
}): { instructions: string; messages: ModelMessage[] } {
  const parts = [contextBlock(input), `Frase alvo: ${markBlanks(input.sentence)}`];
  if (input.neighbors?.length) {
    parts.push(`Frases vizinhas (ordem do texto): ${input.neighbors.join(" | ")}`);
  }
  if (input.options?.length) {
    parts.push(`Alternativas da questão: ${input.options.join(" | ")}`);
  }
  parts.push(
    "",
    "Produza um objeto JSON exatamente com estes campos:",
    `- translation: tradução completa da frase para o português (máx. ${AI_LIMITS.phraseTranslation});`,
    `- tips: de 0 a ${AI_LIMITS.maxTips} itens, cada um { term, note }, para expressões, gírias ou palavras contraintuitivas que NÃO foram traduzidas ao pé da letra (term: o termo em inglês, máx. ${AI_LIMITS.tipTerm}; note: por que não tem sentido literal na frase, máx. ${AI_LIMITS.tipNote}).`,
    "Não inclua dica para palavra cuja tradução na frase é literal e direta.",
  );
  return { instructions: INSTRUCTIONS, messages: [{ role: "user", content: parts.join("\n") }] };
}

/** Formata a primeira dica para o campo contextual do vocabulário (≤ 200). */
export function firstTipAsContextual(result: AiPhraseResult): string | undefined {
  const first = result.tips[0];
  if (!first) return undefined;
  return `${first.term} — ${first.note}`.slice(0, AI_LIMITS.inSentenceTranslation);
}
