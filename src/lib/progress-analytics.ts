// Análise pura de evolução para /progress — comparação de períodos
// (últimos 7 dias vs. 7 anteriores) e médias semanais por task type.

import type { Attempt } from "./storage";
import { TYPE_META, type TaskType } from "@/lib/pte";

const DAY = 86_400_000;

function scoreOf(a: Attempt): number | null {
  return a.score ?? a.contentScore;
}

export interface PeriodComparison {
  /** Média dos últimos 7 dias (null = sem tentativas com score). */
  current: number | null;
  /** Média dos 7 dias anteriores. */
  previous: number | null;
  /** current − previous (null quando falta um dos períodos). */
  delta: number | null;
  currentCount: number;
  previousCount: number;
}

/** Média dos últimos 7 dias vs. os 7 anteriores (janelas fixas terminando em `now`). */
export function periodComparison(attempts: Attempt[], now = Date.now()): PeriodComparison {
  let curSum = 0;
  let curN = 0;
  let prevSum = 0;
  let prevN = 0;
  for (const a of attempts) {
    const s = scoreOf(a);
    if (s === null) continue;
    if (a.ts >= now - 7 * DAY) {
      curSum += s;
      curN += 1;
    } else if (a.ts >= now - 14 * DAY) {
      prevSum += s;
      prevN += 1;
    }
  }
  const current = curN > 0 ? Math.round(curSum / curN) : null;
  const previous = prevN > 0 ? Math.round(prevSum / prevN) : null;
  return {
    current,
    previous,
    delta: current !== null && previous !== null ? current - previous : null,
    currentCount: curN,
    previousCount: prevN,
  };
}

export interface TypeWeekAverages {
  taskType: TaskType;
  label: string;
  attempts: number;
  /** Média por semana; índice 0 = semana atual, null = sem tentativas na semana. */
  weeks: (number | null)[];
}

/** Média semanal por task type nas últimas `weeks` semanas, ordenado por atividade. */
export function weeklyTypeAverages(
  attempts: Attempt[],
  weeks = 6,
  now = Date.now(),
): TypeWeekAverages[] {
  const acc = new Map<TaskType, { sums: number[]; ns: number[]; total: number }>();
  for (const a of attempts) {
    const s = scoreOf(a);
    if (s === null) continue;
    const w = Math.floor((now - a.ts) / (7 * DAY));
    if (w >= weeks) continue;
    let e = acc.get(a.taskType);
    if (!e) {
      e = {
        sums: new Array(weeks).fill(0) as number[],
        ns: new Array(weeks).fill(0) as number[],
        total: 0,
      };
      acc.set(a.taskType, e);
    }
    e.sums[w]! += s;
    e.ns[w]! += 1;
    e.total += 1;
  }
  return [...acc.entries()]
    .map(([taskType, e]) => ({
      taskType,
      label: TYPE_META[taskType]!.label,
      attempts: e.total,
      weeks: e.sums.map((sum, i) => (e.ns[i]! > 0 ? Math.round(sum / e.ns[i]!) : null)),
    }))
    .sort((a, b) => b.attempts - a.attempts);
}
