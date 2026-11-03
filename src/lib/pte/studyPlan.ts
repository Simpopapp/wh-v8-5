// Plano do dia — puro e testável (decisão D10 do PRD, Fase 4).
// Distribui a meta diária pelas seções conforme os pesos derivados da matriz
// oficial tarefa×habilidade (skillMatrix.ts — aproximação rotulada),
// priorizando revisões vencidas (SRS) e, nas questões novas, os tipos com pior
// média recente e maior estoque não tentado. Nunca recomenda mais do que existe.

import type { AppState, QuestionStat } from "../storage";
import { allMeta } from "./manifest";
import { SKILL_WEIGHTS } from "./skillMatrix";
import { SECTION_META, SECTION_ORDER, TYPE_META, type Section, type TaskType } from "./types";

export type PlanCounts = Partial<Record<TaskType, number>>;

/** Meta mínima para distribuir por peso; abaixo disso o plano vem vazio. */
export const MIN_PLAN_SIZE = 4;

export interface DailyPlan {
  /** Totais por task type (vencidas + novas) — entra direto em startMixedSession. */
  counts: PlanCounts;
  /** Parcela do plano que vem de revisões vencidas (SRS). */
  dueCounts: PlanCounts;
  /** Parcela do plano que vem de questões nunca tentadas. */
  newCounts: PlanCounts;
  /** Totais por seção ( Speaking/Writing/Reading/Listening). */
  sections: Record<Section, number>;
  /** Total de questões do plano. */
  total: number;
}

interface TypeStock {
  type: TaskType;
  section: Section;
  /** Revisões vencidas (dueAt no passado). */
  due: number;
  /** Questões nunca tentadas. */
  untried: number;
  /** Média dos últimos scores do tipo (null = nunca treinado → prioridade máxima). */
  recentAvg: number | null;
}

/**
 * Maior resto com teto: divide `total` proporcionalmente aos pesos, respeitando
 * os caps; o que sobra quando um teto estoura é redistribuído entre os demais.
 * Determinístico (empate de resto resolve pela ordem das chaves recebidas).
 */
function largestRemainderSplit(
  total: number,
  weights: Record<string, number>,
  caps: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  let left = total;
  for (let guard = 0; guard < 8 && left > 0; guard++) {
    const w = (k: string): number => weights[k] ?? 0;
    const keys = Object.keys(weights).filter((k) => w(k) > 0 && (caps[k] ?? 0) - (out[k] ?? 0) > 0);
    if (keys.length === 0) break;
    const wSum = keys.reduce((s, k) => s + w(k), 0);
    const roomOf = (k: string) => (caps[k] ?? 0) - (out[k] ?? 0);
    const target = Math.min(
      left,
      keys.reduce((s, k) => s + roomOf(k), 0),
    );
    const rows = keys.map((k) => ({ k, raw: (w(k) / wSum) * target, cap: roomOf(k) }));

    const alloc = new Map<string, number>();
    for (const r of rows) alloc.set(r.k, Math.min(r.cap, Math.floor(r.raw)));
    let rest = target - [...alloc.values()].reduce((s, v) => s + v, 0);
    for (const r of [...rows].sort(
      (a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)),
    )) {
      if (rest <= 0) break;
      const cur = alloc.get(r.k) ?? 0;
      const give = Math.min(r.cap - cur, rest);
      if (give > 0) {
        alloc.set(r.k, cur + give);
        rest -= give;
      }
    }
    let given = 0;
    for (const v of alloc.values()) given += v;
    if (given === 0) break; // nada cabe — evita loop
    for (const [k, v] of alloc) {
      out[k] = (out[k] ?? 0) + v;
      left -= v;
    }
  }
  return out;
}

function stocksOf(
  stats: Map<string, QuestionStat>,
  now: number,
  verifiedOnly?: boolean,
): TypeStock[] {
  const agg = new Map<
    TaskType,
    { section: Section; due: number; untried: number; sum: number; n: number }
  >();
  // Fase 5 (D4/C3): o plano usa o mesmo pool das filas — sem quase-duplicatas e,
  // com "só verificadas" ligado, sem itens de IA/comunitários.
  const pool = verifiedOnly
    ? allMeta.filter((m) => !m.duplicate && m.sourceClass === "verificada")
    : allMeta.filter((m) => !m.duplicate);
  for (const m of pool) {
    if (!TYPE_META[m.taskType].ready) continue;
    const cur = agg.get(m.taskType) ?? { section: m.section, due: 0, untried: 0, sum: 0, n: 0 };
    const s = stats.get(m.id);
    if (!s) {
      cur.untried++;
    } else {
      if (s.dueAt <= now) cur.due++;
      if (s.lastScore !== null) {
        cur.sum += s.lastScore;
        cur.n++;
      }
    }
    agg.set(m.taskType, cur);
  }
  return [...agg.entries()].map(([type, a]) => ({
    type,
    section: a.section,
    due: a.due,
    untried: a.untried,
    recentAvg: a.n > 0 ? a.sum / a.n : null,
  }));
}

/**
 * Plano do dia: `dailyGoal` distribuído pelos pesos do exame, com teto pelo
 * estoque disponível (vencidas + não tentadas por tipo).
 */
export function buildDailyPlan(
  app: Pick<AppState, "attempts"> & { settings: { dailyGoal: number; verifiedOnly?: boolean } },
  stats: Map<string, QuestionStat>,
  now = Date.now(),
): DailyPlan {
  const zero = (): Record<Section, number> => ({
    speaking: 0,
    writing: 0,
    reading: 0,
    listening: 0,
  });
  const empty: DailyPlan = { counts: {}, dueCounts: {}, newCounts: {}, sections: zero(), total: 0 };
  const goal = app.settings.dailyGoal;
  if (typeof goal !== "number" || !Number.isFinite(goal) || goal < MIN_PLAN_SIZE) return empty;

  const stocks = stocksOf(stats, now, app.settings.verifiedOnly);
  const sectionTypes = new Map<Section, TypeStock[]>();
  for (const s of stocks) {
    const list = sectionTypes.get(s.section) ?? [];
    list.push(s);
    sectionTypes.set(s.section, list);
  }

  const avail = zero();
  for (const section of SECTION_ORDER) {
    avail[section] = (sectionTypes.get(section) ?? []).reduce((n, t) => n + t.due + t.untried, 0);
  }
  const total = Math.min(
    Math.floor(goal),
    Object.values(avail).reduce((a, b) => a + b, 0),
  );
  if (total < 1) return empty;

  const quotas = largestRemainderSplit(total, { ...SKILL_WEIGHTS }, avail);

  const counts: PlanCounts = {};
  const dueCounts: PlanCounts = {};
  const newCounts: PlanCounts = {};
  const sections = zero();

  for (const section of SECTION_ORDER) {
    const quota = quotas[section] ?? 0;
    if (quota <= 0) continue;
    const types = sectionTypes.get(section) ?? [];

    // 1) Revisões vencidas primeiro, rateadas entre os tipos conforme o estoque vencido.
    const dueTotal = types.reduce((n, t) => n + t.due, 0);
    const dueTake = Math.min(quota, dueTotal);
    if (dueTake > 0) {
      const dueWeights: Record<string, number> = {};
      const dueCaps: Record<string, number> = {};
      for (const t of types) {
        if (t.due > 0) {
          dueWeights[t.type] = t.due;
          dueCaps[t.type] = t.due;
        }
      }
      const dueSplit = largestRemainderSplit(dueTake, dueWeights, dueCaps);
      for (const [type, n] of Object.entries(dueSplit)) {
        if (n > 0) {
          dueCounts[type as TaskType] = n;
          counts[type as TaskType] = n;
        }
      }
    }

    // 2) Novas preenchem o resto: pior média recente primeiro (null = pior),
    //    depois maior estoque não tentado; teto pelo estoque de cada tipo.
    let rest = quota - dueTake;
    if (rest > 0) {
      const order = [...types].sort((a, b) => {
        const av = a.recentAvg ?? -1;
        const bv = b.recentAvg ?? -1;
        if (av !== bv) return av - bv;
        if (b.untried !== a.untried) return b.untried - a.untried;
        return a.type.localeCompare(b.type);
      });
      for (const t of order) {
        if (rest <= 0) break;
        const room = t.untried;
        if (room <= 0) continue;
        const give = Math.min(room, rest);
        newCounts[t.type] = give;
        counts[t.type] = (counts[t.type] ?? 0) + give;
        rest -= give;
      }
    }

    sections[section] = types.reduce((n, t) => n + (counts[t.type] ?? 0), 0);
  }

  return {
    counts,
    dueCounts,
    newCounts,
    sections,
    total: Object.values(counts).reduce((a, b) => a + (b ?? 0), 0),
  };
}

/** Rótulo do plano (pt-BR): "Hoje: N questões — Speaking X · Listening Y …". */
export function planSummary(plan: DailyPlan): string {
  if (plan.total <= 0) return "Sem plano para hoje";
  const parts = SECTION_ORDER.filter((s) => plan.sections[s] > 0).map(
    (s) => `${SECTION_META[s].label} ${plan.sections[s]}`,
  );
  return `Hoje: ${plan.total} questões${parts.length > 0 ? ` — ${parts.join(" · ")}` : ""}`;
}
