// Manifesto leve: índice de TODAS as questões sem carregar os JSONs completos (~2 MB).
// Home, listas, sessões e navegação anterior/próxima usam só isto; o conteúdo completo
// de cada questão vem sob demanda de `catalog.ts` (import dinâmico por task type).
// Gerado por `node scripts/build-manifest.mjs`.

import manifestJson from "@/data/pte/manifest.json";
import canonicalMapJson from "@/data/pte/canonical-map.json";
import {
  SECTION_META,
  SECTION_ORDER,
  TYPE_META,
  type Difficulty,
  type Section,
  type TaskType,
} from "./types";

// ---------- Proveniência (C2) ----------
// Fontes com curadoria pública vs. comunidade vs. predições geradas por IA.
export type SourceClass = "verificada" | "comunitária" | "ia";

const VERIFIED_SOURCES = new Set([
  "goarno.io",
  "pteacademy.in",
  "band9pte.com.au",
  "stormedugo.com",
  "edknot.com",
  "79score.com",
  "languageacademy.com.au",
  // Fase 7: exemplos oficiais do Test Tips (PDF) da Pearson — SGD e RTS.
  "pearsonpte.com",
  // Fase 7: gráficos do Our World in Data (CC BY 4.0, com atribuição) — Describe Image.
  "ourworldindata.org",
]);
const AI_SOURCES = new Set(["ai-generated-prediction", "pte2-prediction", "pteracai-seed"]);

export function sourceClass(source: string): SourceClass {
  if (VERIFIED_SOURCES.has(source)) return "verificada";
  if (AI_SOURCES.has(source)) return "ia";
  return "comunitária"; // desconhecida ou anki-cards: nunca tratada como verificada
}

// ---------- Duplicatas (C3) ----------
// `canonical-map.json` (gerado por .opencode/proj9-work/dedupe.mjs): qid → id canônico.
// Duplicatas continuam no banco (selo "repetida") mas saem das filas de treino.
const CANONICAL_MAP = new Map<string, string>(
  Object.entries(canonicalMapJson as Record<string, string>),
);

export function canonicalIdOf(id: string): string {
  return CANONICAL_MAP.get(id) ?? id;
}

export function isDuplicateId(id: string): boolean {
  const c = CANONICAL_MAP.get(id);
  return c !== undefined && c !== id;
}

export interface QuestionMeta {
  id: string;
  taskType: TaskType;
  section: Section;
  topic: string;
  source: string;
  wordCount: number;
  difficulty?: Difficulty;
  /** Selo de proveniência (C2). */
  sourceClass: SourceClass;
  /** Id canônico do grupo de quase-duplicatas (C3) — o próprio id quando única. */
  canonicalId: string;
  /** True quando a questão é quase-duplicata de outra e sai das filas. */
  duplicate: boolean;
}

interface RawRow {
  id: string;
  t: TaskType;
  s: Section;
  topic: string;
  src: string;
  wc: number;
  d?: Difficulty;
}

export const allMeta: QuestionMeta[] = (manifestJson as RawRow[]).map((r) => ({
  id: r.id,
  taskType: r.t,
  section: r.s,
  topic: r.topic,
  source: r.src,
  wordCount: r.wc,
  sourceClass: sourceClass(r.src),
  canonicalId: canonicalIdOf(r.id),
  duplicate: isDuplicateId(r.id),
  ...(r.d ? { difficulty: r.d } : {}),
}));

export const TOTAL_ALL_QUESTIONS = allMeta.length;

const byType = new Map<TaskType, QuestionMeta[]>();
const bySection = new Map<Section, QuestionMeta[]>();
const byId = new Map<string, QuestionMeta>();
for (const m of allMeta) {
  byId.set(m.id, m);
  const t = byType.get(m.taskType) ?? [];
  t.push(m);
  byType.set(m.taskType, t);
  const s = bySection.get(m.section) ?? [];
  s.push(m);
  bySection.set(m.section, s);
}

export const typeCounts = (Object.keys(TYPE_META) as TaskType[]).reduce(
  (acc, t) => {
    acc[t] = byType.get(t)?.length ?? 0;
    return acc;
  },
  {} as Record<TaskType, number>,
);

export const sectionCounts = SECTION_ORDER.reduce(
  (acc, s) => {
    acc[s] = bySection.get(s)?.length ?? 0;
    return acc;
  },
  {} as Record<Section, number>,
);

/** Total de task types do catálogo (derivado de TYPE_META — nunca hardcodar). */
export const TYPE_COUNT = Object.keys(TYPE_META).length;

/** Total de questões formatado em pt-BR (ex.: "2.536") para UI e metas de SEO. */
export const TOTAL_ALL_QUESTIONS_LABEL = TOTAL_ALL_QUESTIONS.toLocaleString("pt-BR");

/** Contagem de uma seção formatada em pt-BR (ex.: "1.168"). */
export const sectionCountLabel = (section: Section) =>
  (sectionCounts[section] ?? 0).toLocaleString("pt-BR");

/** Linhas do manifesto de um task type (ordem estável do banco). */
export function metaByType(taskType: TaskType): QuestionMeta[] {
  return byType.get(taskType) ?? [];
}

export function metaBySection(section: Section): QuestionMeta[] {
  return bySection.get(section) ?? [];
}

export function getMeta(id: string | undefined): QuestionMeta | undefined {
  return id ? byId.get(id) : undefined;
}

/** Id da questão vizinha dentro do mesmo task type (circular). */
export function siblingId(id: string, delta: 1 | -1): string | undefined {
  const m = byId.get(id);
  if (!m) return undefined;
  const list = byType.get(m.taskType) ?? [];
  const i = list.findIndex((x) => x.id === id);
  if (i < 0 || list.length === 0) return undefined;
  return list[(i + delta + list.length) % list.length]?.id;
}

export const nextIdInType = (id: string) => siblingId(id, 1);
export const prevIdInType = (id: string) => siblingId(id, -1);

/** Posição (1-based) e total da questão dentro do seu task type. */
export function positionInType(id: string): { number: number; total: number } {
  const m = byId.get(id);
  const list = m ? (byType.get(m.taskType) ?? []) : [];
  return { number: list.findIndex((x) => x.id === id) + 1, total: list.length };
}

/** Primeira questão de cada task type (para os atalhos "praticar"). */
export function firstIdOfType(taskType: TaskType): string | undefined {
  return byType.get(taskType)?.[0]?.id;
}

/** Selo "banco pequeno" (C4): tipo com ≤ 6 itens — treine, mas não confie na cobertura. */
export const SMALL_BANK_MAX = 6;
export function isSmallBank(taskType: TaskType): boolean {
  return (typeCounts[taskType] ?? 0) <= SMALL_BANK_MAX;
}

export { SECTION_META, SECTION_ORDER, TYPE_META };
export type { Section, TaskType };
