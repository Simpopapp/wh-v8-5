import { beforeEach, describe, expect, it } from "vitest";

import { periodComparison, weeklyTypeAverages } from "@/lib/progress-analytics";
import type { Attempt } from "@/lib/storage";

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0); // 10/10/2026 12:00 UTC
const DAY = 86_400_000;

function attempt(taskType: Attempt["taskType"], daysAgo: number, score: number | null): Attempt {
  return {
    qid: `q-${taskType}-${daysAgo}-${score}`,
    ts: NOW - daysAgo * DAY,
    taskType,
    mode: "manual",
    contentScore: null,
    score,
    wpm: null,
    durationMs: 0,
  };
}

beforeEach(() => {
  // funções puras — nada de storage
});

describe("periodComparison", () => {
  it("compara últimos 7 dias vs. 7 anteriores", () => {
    const attempts = [
      attempt("wfd", 1, 80),
      attempt("wfd", 2, 90), // semana atual → 85
      attempt("wfd", 8, 70),
      attempt("wfd", 10, 90), // semana anterior → 80
      attempt("swt", 20, 100), // fora das duas janelas
    ];
    const c = periodComparison(attempts, NOW);
    expect(c.current).toBe(85);
    expect(c.previous).toBe(80);
    expect(c.delta).toBe(5);
    expect(c.currentCount).toBe(2);
    expect(c.previousCount).toBe(2);
  });

  it("delta null quando falta um dos períodos", () => {
    const c = periodComparison([attempt("wfd", 1, 80)], NOW);
    expect(c.current).toBe(80);
    expect(c.previous).toBeNull();
    expect(c.delta).toBeNull();
  });

  it("ignora tentativas sem score", () => {
    const c = periodComparison([attempt("wfd", 1, null)], NOW);
    expect(c.current).toBeNull();
    expect(c.currentCount).toBe(0);
  });
});

describe("weeklyTypeAverages", () => {
  it("média semanal por tipo, índice 0 = semana atual", () => {
    const attempts = [
      attempt("wfd", 0, 70),
      attempt("wfd", 1, 90), // semana atual: 80
      attempt("wfd", 9, 50), // semana passada (2ª anterior): 50
      attempt("read_aloud", 2, 60),
    ];
    const rows = weeklyTypeAverages(attempts, 6, NOW);
    expect(rows[0]!.taskType).toBe("wfd"); // mais ativo primeiro
    expect(rows[0]!.weeks[0]).toBe(80);
    expect(rows[0]!.weeks[1]).toBe(50); // 9 dias atrás → 2ª semana
    expect(rows[0]!.weeks[2]).toBeNull();
    expect(rows[0]!.attempts).toBe(3);
    expect(rows[1]!.taskType).toBe("read_aloud");
    expect(rows[1]!.weeks[0]).toBe(60);
  });

  it("descarta tentativas mais antigas que a janela", () => {
    const rows = weeklyTypeAverages([attempt("wfd", 45, 90)], 6, NOW);
    expect(rows).toHaveLength(0);
  });
});
