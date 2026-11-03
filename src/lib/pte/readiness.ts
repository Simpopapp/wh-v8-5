// Índice de prontidão por seção e estimativa por habilidade — puros e testáveis
// (Fase 4 do projeto 9, PRD §3.4 — decisões D3 e D4).
//
// Prontidão (0–100, índice interno): o núcleo é o DESEMPENHO RECENTE PONDERADO
// (média exponencial pela recência das tentativas com score) + tendência
// (média dos últimos 7 dias vs. os 7 anteriores) + confiança pelo n de
// tentativas com score (menos de 10 → "confiança baixa" explícita). Cobertura
// do banco e variedade de tipos são SECUNDÁRIAS: só reduzem o índice quando
// absurdamente baixas — nunca mais 40% do índice como na versão anterior (B2).
//
// Estimativa (10–90, rotulada "estimativa de treino"): a % interna ponderada é
// mapeada pela escala oficial via estimateSkill(); tarefas que pontuam mais de
// uma habilidade contam em todas (matriz oficial — skillMatrix.ts, D10).
//
// O n e a cobertura vêm do SNAPSHOT (app.questions — sobrevive ao corte do
// log); os scores recentes vêm do log (as tentativas mais recentes sempre
// permanecem). Nenhuma caixa/due é derivada aqui (regra do storage v6).

import type { AppState, Attempt } from "../storage";
import { getMeta, sectionCounts } from "./manifest";
import { SECTION_META, SECTION_ORDER, TYPE_META, type Section, type TaskType } from "./types";
import { confidenceFor, estimateSkill, type Confidence } from "./estimate";
import { TASK_SKILLS, type Skill } from "./skillMatrix";

const DAY = 86_400_000;

/** Meia-vida do peso de recência: uma tentativa de 7 dias atrás vale metade. */
const HALF_LIFE_DAYS = 7;
/** Tamanho da janela da tendência (dias). */
const TREND_WINDOW_DAYS = 7;
/** Tentativas em itens de IA/seed pesam menos na média (D4). */
const AI_SOURCE_WEIGHT = 0.7;
/** Redução secundária máxima no índice (cobertura/variedade absurdamente baixas). */
const MAX_SECONDARY_PENALTY = 10;
/** Ajuste máximo da tendência no índice (pontos). */
const MAX_TREND_ADJUSTMENT = 5;

export type ReadinessLevel = "Iniciando" | "Em progresso" | "Quase pronto" | "Pronto";

/** Rótulo por faixa do índice (decisão D3). */
export function readinessLevel(score: number): ReadinessLevel {
  if (score < 40) return "Iniciando";
  if (score < 65) return "Em progresso";
  if (score < 85) return "Quase pronto";
  return "Pronto";
}

// ---------- Tentativas com score ----------

interface ScoredAttempt {
  type: TaskType;
  ts: number;
  score: number;
  /** Peso da fonte (1; 0,7 para IA/seed — D4). */
  weight: number;
}

function scoreOf(a: Attempt): number | null {
  return a.score ?? a.contentScore;
}

/** Tentativas com score, com o peso de fonte resolvido pelo manifesto. */
function scoredAttempts(app: Pick<AppState, "attempts">): ScoredAttempt[] {
  const out: ScoredAttempt[] = [];
  for (const a of app.attempts) {
    const s = scoreOf(a);
    if (s === null) continue;
    out.push({
      type: a.taskType,
      ts: a.ts,
      score: s,
      // D4 (Fase 5): peso pela classe de fonte do manifesto (ia = 0,7).
      weight: getMeta(a.qid)?.sourceClass === "ia" ? AI_SOURCE_WEIGHT : 1,
    });
  }
  return out;
}

/** Média ponderada: peso exponencial pela recência × peso de fonte (null sem dados). */
function weightedMean(rows: ScoredAttempt[], now: number): number | null {
  if (rows.length === 0) return null;
  let sum = 0;
  let wSum = 0;
  for (const r of rows) {
    const ageDays = Math.max(0, (now - r.ts) / DAY);
    const w = r.weight * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    sum += w * r.score;
    wSum += w;
  }
  if (wSum === 0) return null;
  return sum / wSum;
}

/** Média simples das tentativas com ts ≥ `from` e (quando dado) ts < `to`. */
function windowMean(rows: ScoredAttempt[], from: number, to?: number): number | null {
  const inWindow = rows
    .filter((r) => r.ts >= from && (to === undefined || r.ts < to))
    .map((r) => r.score);
  if (inWindow.length === 0) return null;
  return inWindow.reduce((s, v) => s + v, 0) / inWindow.length;
}

/** Tipos prontos por seção (denominador da variedade). */
const SECTION_TYPE_COUNTS: Record<Section, number> = SECTION_ORDER.reduce(
  (acc, s) => {
    acc[s] = (Object.keys(TYPE_META) as TaskType[]).filter(
      (t) => TYPE_META[t].section === s && TYPE_META[t].ready,
    ).length;
    return acc;
  },
  {} as Record<Section, number>,
);

const zeroCounts = (): Record<Section, number> => ({
  speaking: 0,
  writing: 0,
  reading: 0,
  listening: 0,
});

const emptySets = (): Record<Section, Set<string>> => ({
  speaking: new Set(),
  writing: new Set(),
  reading: new Set(),
  listening: new Set(),
});

// ---------- Prontidão por seção ----------

export interface SectionReadiness {
  section: Section;
  label: string;
  /** Questões distintas da seção já tentadas (via snapshot — sobrevive ao corte do log). */
  attempted: number;
  /** Total de questões da seção no banco. */
  total: number;
  /** Cobertura 0–100 (tentadas/total). */
  coverage: number;
  /** Média simples das tentativas com score dos últimos 7 dias (null = sem dados). */
  recentScore: number | null;
  /** % interno ponderado pela recência — núcleo do índice (null = sem dados). */
  recentPct: number | null;
  /** Tendência: média dos últimos 7d menos a dos 7d anteriores (pontos %, null). */
  trend: number | null;
  /** Tentativas com score na seção (histórico completo, via snapshot). */
  n: number;
  confidence: Confidence;
  /** Pontos reduzidos por cobertura/variedade baixas (secundário, teto 10). */
  secondaryPenalty: number;
  /** Índice final 0–100. */
  score: number;
  level: ReadinessLevel;
  /** ≥ 1 tentativa com score nesta seção (histórico ou log). */
  hasData: boolean;
}

/**
 * Prontidão das 4 seções. `totals` permite testar sem depender do banco real;
 * por padrão usa os totais do manifesto.
 */
export function readinessBySection(
  app: Pick<AppState, "attempts" | "questions">,
  now = Date.now(),
  totals: Record<Section, number> = sectionCounts,
): SectionReadiness[] {
  const rows = scoredAttempts(app);

  // Contagens do snapshot: n (tentativas com score), cobertura e variedade.
  const nBySection = zeroCounts();
  const attemptedBySection = emptySets();
  const typesBySection = emptySets();
  for (const [qid, snap] of Object.entries(app.questions)) {
    const m = getMeta(qid);
    if (!m) continue;
    nBySection[m.section] += snap.attempts;
    attemptedBySection[m.section].add(qid);
    typesBySection[m.section].add(m.taskType);
  }

  return SECTION_ORDER.map((section) => {
    const secRows = rows.filter((r) => TYPE_META[r.type].section === section);
    const total = totals[section] ?? 0;
    const attempted = attemptedBySection[section].size;
    const coverage = total > 0 ? Math.round((attempted / total) * 100) : 0;
    const recentScore = windowMean(secRows, now - TREND_WINDOW_DAYS * DAY);
    const priorMean = windowMean(
      secRows,
      now - 2 * TREND_WINDOW_DAYS * DAY,
      now - TREND_WINDOW_DAYS * DAY,
    );
    const trend = recentScore !== null && priorMean !== null ? recentScore - priorMean : null;
    const recentPctRaw = weightedMean(secRows, now);
    const recentPct = recentPctRaw === null ? null : Math.round(recentPctRaw);
    const n = nBySection[section];
    const confidence = confidenceFor(n);
    const hasData = n > 0 || secRows.length > 0;

    const base = {
      section,
      label: SECTION_META[section].label,
      attempted,
      total,
      coverage,
      recentScore,
      recentPct,
      trend,
      n,
      confidence,
      hasData,
    };

    if (!hasData) {
      return { ...base, secondaryPenalty: 0, score: 0, level: readinessLevel(0) };
    }

    const start = recentPct ?? 0;
    const adjustment =
      trend === null
        ? 0
        : Math.max(-MAX_TREND_ADJUSTMENT, Math.min(MAX_TREND_ADJUSTMENT, trend / 2));
    const typeTotal = SECTION_TYPE_COUNTS[section];
    const varietyPct = typeTotal > 0 ? (typesBySection[section].size / typeTotal) * 100 : 0;
    const secondaryPenalty = Math.min(
      MAX_SECONDARY_PENALTY,
      (coverage < 10 ? 5 : 0) + (varietyPct < 25 ? 5 : 0),
    );
    const score = Math.max(0, Math.min(100, Math.round(start + adjustment - secondaryPenalty)));

    return { ...base, secondaryPenalty, score, level: readinessLevel(score) };
  });
}

/**
 * Seção de menor índice entre as que têm dados; empate resolve pela ordem
 * canônica (speaking → writing → reading → listening). null se nada foi tentado.
 */
export function weakestSection(readiness: SectionReadiness[]): Section | null {
  let weakest: Section | null = null;
  let min = Infinity;
  for (const r of readiness) {
    if (!r.hasData) continue;
    if (r.score < min) {
      min = r.score;
      weakest = r.section;
    }
  }
  return weakest;
}

// ---------- Estimativa por habilidade (10–90, D3) ----------

export interface SkillEstimate {
  skill: Skill;
  label: string;
  /** Estimativa de treino 10–90 (null = sem tentativas com score). */
  estimate: number | null;
  /** % interno ponderado que gerou a estimativa (null = sem dados). */
  recentPct: number | null;
  /** Tentativas com score na habilidade (histórico, via snapshot). */
  n: number;
  confidence: Confidence;
  /** ≥ 1 tentativa com score nesta habilidade (histórico ou log). */
  hasData: boolean;
}

/**
 * Estimativa de treino por habilidade. Tarefas que pontuam mais de uma
 * habilidade (ex.: WFD → Listening + Writing) contribuem para todas
 * (matriz oficial — TASK_SKILLS).
 */
export function estimateBySkill(
  app: Pick<AppState, "attempts" | "questions">,
  now = Date.now(),
): SkillEstimate[] {
  const rows = scoredAttempts(app);
  const nBySkill = zeroCounts();
  for (const [qid, snap] of Object.entries(app.questions)) {
    const m = getMeta(qid);
    if (!m) continue;
    for (const skill of TASK_SKILLS[m.taskType] ?? []) nBySkill[skill] += snap.attempts;
  }
  const skills: Skill[] = ["speaking", "writing", "reading", "listening"];
  return skills.map((skill) => {
    const skillRows = rows.filter((r) => (TASK_SKILLS[r.type] ?? []).includes(skill));
    const pct = weightedMean(skillRows, now);
    const n = nBySkill[skill];
    return {
      skill,
      label: SECTION_META[skill].label,
      estimate: pct === null ? null : estimateSkill(pct),
      recentPct: pct === null ? null : Math.round(pct),
      n,
      confidence: confidenceFor(n),
      hasData: n > 0 || skillRows.length > 0,
    };
  });
}

/** Estimativa de treino geral (todas as tentativas com score, ponderada). */
export function overallEstimate(
  app: Pick<AppState, "attempts" | "questions">,
  now = Date.now(),
): number | null {
  const pct = weightedMean(scoredAttempts(app), now);
  return pct === null ? null : estimateSkill(pct);
}
