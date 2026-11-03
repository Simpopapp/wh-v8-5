import { describe, expect, it } from "vitest";

import { allMeta, typeCounts } from "@/lib/pte/manifest";
import { SKILL_WEIGHTS } from "@/lib/pte/skillMatrix";
import { buildDailyPlan, MIN_PLAN_SIZE, planSummary, type PlanCounts } from "@/lib/pte/studyPlan";
import type { QuestionStat } from "@/lib/storage";
import type { TaskType } from "@/lib/pte/types";

function stat(patch: Partial<QuestionStat> = {}): QuestionStat {
  return {
    attempts: 1,
    bestContent: null,
    bestWpm: null,
    lastAttemptAt: 0,
    lastScore: null,
    strongAttempts: 0,
    box: 1,
    dueAt: 0,
    ...patch,
  };
}

const app = (dailyGoal: number) => ({ attempts: [], settings: { dailyGoal } });
const NOW = 1_700_000_000_000;

function emptyStats(): Map<string, QuestionStat> {
  return new Map();
}

/** Marca as primeiras `n` questões de um tipo como vencidas. */
function withDue(
  stats: Map<string, QuestionStat>,
  type: TaskType,
  n: number,
  lastScore = 60,
): Map<string, QuestionStat> {
  let i = 0;
  for (const m of allMeta) {
    if (m.taskType !== type || i >= n) continue;
    stats.set(m.id, stat({ lastScore, dueAt: NOW - 1000 }));
    i++;
  }
  return stats;
}

/** Média recente (lastScore) para as primeiras `n` tentadas de um tipo. */
function withScores(
  stats: Map<string, QuestionStat>,
  type: TaskType,
  n: number,
  score: number,
): Map<string, QuestionStat> {
  let i = 0;
  for (const m of allMeta) {
    if (m.taskType !== type || i >= n) continue;
    stats.set(m.id, stat({ lastScore: score, dueAt: NOW + 86_400_000 }));
    i++;
  }
  return stats;
}

describe("SKILL_WEIGHTS (derivados da matriz oficial — D10)", () => {
  it("soma 100 e reflete a matriz tarefa×habilidade", () => {
    expect(Object.values(SKILL_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(SKILL_WEIGHTS.speaking).toBe(20);
    expect(SKILL_WEIGHTS.listening).toBe(40);
    expect(SKILL_WEIGHTS.reading).toBe(27);
    expect(SKILL_WEIGHTS.writing).toBe(13);
  });
});

describe("buildDailyPlan — distribuição proporcional", () => {
  it("divide a meta 20 pelos pesos derivados (20/40/27/13)", () => {
    const plan = buildDailyPlan(app(20), emptyStats(), NOW);
    expect(plan.total).toBe(20);
    expect(plan.sections.speaking).toBe(4);
    expect(plan.sections.listening).toBe(8);
    expect(plan.sections.reading).toBe(5);
    expect(plan.sections.writing).toBe(3);
  });

  it("goal ímpar usa maiores restos sem perder questões", () => {
    const plan = buildDailyPlan(app(15), emptyStats(), NOW);
    expect(plan.total).toBe(15);
    const sum = Object.values(plan.sections).reduce((a, b) => a + b, 0);
    expect(sum).toBe(15);
  });

  it("nunca recomenda mais do que o estoque de cada tipo", () => {
    const plan = buildDailyPlan(app(500), emptyStats(), NOW);
    for (const [t, n] of Object.entries(plan.counts) as [TaskType, number][]) {
      expect(n).toBeLessThanOrEqual(typeCounts[t]);
    }
    expect(plan.total).toBeLessThanOrEqual(500);
  });
});

describe("buildDailyPlan — prioridade de vencidas (SRS)", () => {
  it("usa as revisões vencidas antes das novas", () => {
    const stats = withDue(new Map(), "wfd", 5);
    const plan = buildDailyPlan(app(10), stats, NOW);
    // Listening tem peso 40 → cota 4 de 10; tudo vem de wfd vencida.
    expect(plan.sections.listening).toBe(4);
    expect(plan.dueCounts.wfd).toBe(4);
    expect(plan.newCounts.wfd ?? 0).toBeLessThanOrEqual(plan.counts.wfd ?? 0);
  });

  it("quando as vencidas não enchem a cota, novas completam", () => {
    const stats = withDue(new Map(), "mcq_single", 2);
    const plan = buildDailyPlan(app(10), stats, NOW);
    const dueSingle = plan.dueCounts.mcq_single ?? 0;
    expect(dueSingle).toBe(2);
    expect((plan.counts.mcq_single ?? 0) + (plan.dueCounts.mcq_multi ?? 0)).toBeGreaterThanOrEqual(
      dueSingle,
    );
  });
});

describe("buildDailyPlan — prioridade de novas", () => {
  it("tipo com pior média recente recebe as primeiras novas", () => {
    const stats = withScores(new Map(), "mcq_single", 10, 40); // média ruim
    withScores(stats, "mcq_multi", 2, 95); // média boa
    const plan = buildDailyPlan(app(10), stats, NOW);
    // Reading: cota 3. Tipos nunca treinados (média null) vêm antes de mcq_single (40),
    // que por sua vez vem antes de mcq_multi (95).
    expect(plan.sections.reading).toBe(3);
    const never = (plan.newCounts.reorder_paragraphs ?? 0) + (plan.newCounts.read_fib ?? 0);
    expect(never).toBe(3);
    expect(plan.newCounts.mcq_single ?? 0).toBe(0);
  });
});

describe("buildDailyPlan — metas pequenas e vazias", () => {
  it("goal < 4 → plano vazio", () => {
    expect(buildDailyPlan(app(3), emptyStats(), NOW).total).toBe(0);
    expect(MIN_PLAN_SIZE).toBe(4);
  });

  it("goal 0 → plano vazio", () => {
    expect(buildDailyPlan(app(0), emptyStats(), NOW).total).toBe(0);
  });

  it("estoque esgotado (tudo tentado, nada vencido) → plano vazio", () => {
    const stats = new Map<string, QuestionStat>();
    for (const m of allMeta) stats.set(m.id, stat({ lastScore: 90, dueAt: NOW + 86_400_000 }));
    expect(buildDailyPlan(app(20), stats, NOW).total).toBe(0);
  });

  it("teto por estoque: tudo vencido entra antes de estourar o disponível", () => {
    const stats = withDue(new Map(), "wfd", typeCounts.wfd);
    const plan = buildDailyPlan(app(20), stats, NOW);
    expect(plan.counts.wfd).toBeLessThanOrEqual(typeCounts.wfd);
  });
});

describe("planSummary", () => {
  it("rotula o plano por seção", () => {
    const plan = buildDailyPlan(app(20), emptyStats(), NOW);
    expect(planSummary(plan)).toBe(
      "Hoje: 20 questões — Speaking 4 · Writing 3 · Reading 5 · Listening 8",
    );
  });

  it("plano vazio tem rótulo próprio", () => {
    expect(planSummary(buildDailyPlan(app(0), emptyStats(), NOW))).toBe("Sem plano para hoje");
  });
});

describe("compatibilidade com sessão mista", () => {
  it("counts é aceito como MixCounts (só tipos prontos, valores > 0)", () => {
    const plan = buildDailyPlan(app(20), emptyStats(), NOW);
    const counts: PlanCounts = plan.counts;
    for (const [, n] of Object.entries(counts)) expect(n).toBeGreaterThan(0);
  });
});
