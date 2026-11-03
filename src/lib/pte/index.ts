// Camada de dados PTE.
//  - manifest.ts : índice leve e síncrono (contagens, listas, navegação) — use para UI geral.
//  - catalog.ts  : conteúdo completo carregado sob demanda por task type.
//  - readaloud.ts: API legada de Read Aloud (síncrona, importa o JSON inteiro) — NÃO importe em
//    código de rota/UI; ela existe por compatibilidade com testes e ferramentas.

export {
  SECTION_META,
  SECTION_ORDER,
  TYPE_META,
  TYPE_COUNT,
  TOTAL_ALL_QUESTIONS,
  TOTAL_ALL_QUESTIONS_LABEL,
  allMeta,
  sectionCounts,
  sectionCountLabel,
  typeCounts,
  metaBySection,
  metaByType,
  getMeta,
  nextIdInType,
  prevIdInType,
  positionInType,
  firstIdOfType,
  // Proveniência e quase-duplicatas (Fase 5, C2/C3).
  sourceClass,
  canonicalIdOf,
  isDuplicateId,
  isSmallBank,
  SMALL_BANK_MAX,
} from "./manifest";
export type { QuestionMeta, SourceClass } from "./manifest";
export {
  ALL_TASK_TYPES,
  getLoadedQuestion,
  loadAllQuestions,
  loadQuestion,
  loadQuestions,
  loadTypeQuestions,
} from "./catalog";
export { tokenize } from "./types";
export type {
  Difficulty,
  Question as UnifiedQuestion,
  ReadAloudQuestion,
  RepeatSentenceQuestion,
  RetellLectureQuestion,
  AnswerShortQuestion,
  SwtQuestion,
  WriteEssayQuestion,
  SstQuestion,
  DictationQuestion,
  FibQuestion,
  HiwQuestion,
  ChoiceQuestion,
  SummaryChoiceQuestion,
  ReorderQuestion,
  ReadFibQuestion,
  SgdQuestion,
  RespondSituationQuestion,
  DescribeImageQuestion,
  Section,
  TaskType,
} from "./types";
