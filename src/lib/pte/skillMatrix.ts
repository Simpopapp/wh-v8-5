// Matriz oficial tarefa×habilidade e pesos derivados (decisão D10, PRD §6).
// Fonte: PTE Academic Score Guide e páginas de formato da Pearson, confirmadas
// em 11/10/2026 (Fase 0 do projeto 9). Os pesos numéricos oficiais da agregação
// do score são proprietários — aqui eles são DERIVADOS da matriz por contagem
// de contribuições (maiores restos para fechar 100), uma aproximação rotulada.

import type { Section, TaskType } from "./types";

/** As 4 habilidades do PTE compartilham os rótulos das seções do app. */
export type Skill = Section;

/**
 * Matriz oficial: habilidades pontuadas por task type do catálogo (Score Guide,
 * verbatim no PRD §6). Duas decisões conservadoras registradas:
 * - FIB drag&drop → só Reading (o Score Guide lista só Reading; a página de
 *   Reading menciona +Writing — ambiguidade oficial registrada no PRD).
 * - "Summarize the Audio" (lst_summary) não existe no formato oficial atual →
 *   tratado como Listening (a seção do catálogo).
 */
export const TASK_SKILLS: Record<TaskType, Skill[]> = {
  read_aloud: ["speaking"],
  repeat_sentence: ["listening", "speaking"],
  retell_lecture: ["listening", "speaking"],
  answer_short: ["listening"],
  swt: ["reading", "writing"],
  write_essay: ["writing"],
  mcq_single: ["reading"],
  mcq_multi: ["reading"],
  reorder_paragraphs: ["reading"],
  read_fib: ["reading"],
  wfd: ["listening", "writing"],
  lst_fib: ["listening"],
  summarize_spoken_text: ["listening", "writing"],
  lst_hiw: ["listening", "reading"],
  lst_hcs: ["listening", "reading"],
  lst_summary: ["listening"],
  lst_smw: ["listening"],
  lst_mcq: ["listening"],
  lst_mcq_multi: ["listening"],
  // Fase 7 (projeto 9): matriz oficial dos tipos novos (Score Guide — verbatim no PRD §6).
  summarize_group_discussion: ["listening", "speaking"],
  respond_to_situation: ["speaking"],
  describe_image: ["speaking"],
};

/**
 * Matriz oficial completa (Score Guide, verbatim no PRD §6 — Fase 0): as 21
 * tarefas pontuadas do formato vigente, uma linha por tarefa. As decisões
 * conservadoras registradas:
 * - FIB drag&drop → só Reading (Score Guide lista só Reading; a página de
 *   Reading menciona +Writing — ambiguidade oficial registrada no PRD).
 * - Os 3 tipos ainda ausentes do catálogo (Describe Image, Summarize Group
 *   Discussion, Respond to a Situation) entram na matriz para os pesos
 *   refletirem a prova completa (Fase 7 do PRD os integrará).
 * Os pesos são DERIVADOS destas linhas — nunca da lista de tipos do catálogo,
 * que ainda não cobre a prova inteira.
 */
const OFFICIAL_MATRIX: readonly { name: string; skills: Skill[] }[] = [
  { name: "Read Aloud", skills: ["speaking"] },
  { name: "Repeat Sentence", skills: ["listening", "speaking"] },
  { name: "Describe Image", skills: ["speaking"] },
  { name: "Re-tell Lecture", skills: ["listening", "speaking"] },
  { name: "Answer Short Question", skills: ["listening"] },
  { name: "Summarize Group Discussion", skills: ["listening", "speaking"] },
  { name: "Respond to a Situation", skills: ["speaking"] },
  { name: "Summarize Written Text", skills: ["reading", "writing"] },
  { name: "Write Essay", skills: ["writing"] },
  { name: "Fill in the Blanks (dropdown, Reading)", skills: ["reading"] },
  { name: "Multiple Choice, Multiple Answers (Reading)", skills: ["reading"] },
  { name: "Re-order Paragraphs", skills: ["reading"] },
  { name: "Fill in the Blanks (drag & drop)", skills: ["reading"] },
  { name: "Multiple Choice, Single Answer (Reading)", skills: ["reading"] },
  { name: "Summarize Spoken Text", skills: ["listening", "writing"] },
  { name: "Multiple Choice, Multiple Answers (Listening)", skills: ["listening"] },
  { name: "Fill in the Blanks (type-in, Listening)", skills: ["listening"] },
  { name: "Highlight Correct Summary", skills: ["listening", "reading"] },
  { name: "Multiple Choice, Single Answer (Listening)", skills: ["listening"] },
  { name: "Select Missing Word", skills: ["listening"] },
  { name: "Highlight Incorrect Words", skills: ["listening", "reading"] },
  { name: "Write From Dictation", skills: ["listening", "writing"] },
];

const SKILL_ORDER: Skill[] = ["speaking", "writing", "reading", "listening"];

function deriveCounts(): Record<Skill, number> {
  const counts: Record<Skill, number> = { speaking: 0, writing: 0, reading: 0, listening: 0 };
  for (const row of OFFICIAL_MATRIX) {
    for (const s of row.skills) counts[s]! += 1;
  }
  return counts;
}

function deriveWeights(): Record<Skill, number> {
  const counts = deriveCounts();
  const total = SKILL_ORDER.reduce((n, k) => n + counts[k]!, 0);
  const exact = SKILL_ORDER.map((k) => (counts[k]! * 100) / total);
  const out = {} as Record<Skill, number>;
  let left = 100;
  SKILL_ORDER.forEach((k, i) => {
    out[k] = Math.floor(exact[i]!);
    left -= out[k]!;
  });
  // Maiores restos recebem os inteiros que faltam (empate resolve pela ordem canônica).
  const byRemainder = [...SKILL_ORDER].sort((a, b) => {
    const fa = exact[SKILL_ORDER.indexOf(a)]! - Math.floor(exact[SKILL_ORDER.indexOf(a)]!);
    const fb = exact[SKILL_ORDER.indexOf(b)]! - Math.floor(exact[SKILL_ORDER.indexOf(b)]!);
    return fb - fa || SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b);
  });
  for (let i = 0; i < left; i++) out[byRemainder[i]!]! += 1;
  return out;
}

/** Quantas tarefas (incluindo as ausentes do catálogo) pontuam cada habilidade. */
export const SKILL_CONTRIBUTIONS: Record<Skill, number> = deriveCounts();

/** Peso de cada habilidade na prova (0–100, somam 100) — derivado, nunca fixado à mão. */
export const SKILL_WEIGHTS: Record<Skill, number> = deriveWeights();

/** Habilidades que uma tarefa pontua (todas as do catálogo estão na matriz). */
export function skillsFor(taskType: TaskType): Skill[] {
  return TASK_SKILLS[taskType] ?? [];
}
