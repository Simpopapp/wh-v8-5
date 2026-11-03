import { describe, expect, it } from "vitest";

import {
  renderReportJson,
  renderReportMarkdown,
  weeklyReport,
  type WeeklyReport,
} from "@/lib/pte/report";
import type { AppState, Attempt, QuestionStat } from "@/lib/storage";
import { DEFAULT_SETTINGS, emptyState } from "@/lib/storage";
import { firstIdOfType } from "@/lib/pte/manifest";
import type { TaskType } from "@/lib/pte/types";

const DAY = 86_400_000;

function attempt(patch: Partial<Attempt> & { qid: string }): Attempt {
  return {
    ts: Date.now() - 3600_000,
    taskType: "read_aloud",
    mode: "manual",
    contentScore: null,
    score: 80,
    wpm: null,
    durationMs: 10_000,
    ...patch,
  };
}

function appWith(attempts: Attempt[], patch: Partial<AppState> = {}): AppState {
  return { ...emptyState(DEFAULT_SETTINGS), attempts, ...patch };
}

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

const NOW = Date.now();

describe("weeklyReport", () => {
  it("sem tentativas → relatório vazio, mas completo", () => {
    const r = weeklyReport(appWith([]), NOW);
    expect(r.attemptsCount).toBe(0);
    expect(r.overallAvg).toBeNull();
    expect(r.delta7d).toBeNull();
    expect(r.estimate).toBeNull();
    expect(r.sections).toHaveLength(4);
    expect(r.topErrors).toEqual([]);
    expect(r.streak).toBe(0);
  });

  it("soma tentativas e média dos últimos 7 dias", () => {
    const r = weeklyReport(
      appWith([
        attempt({ qid: "ra-1", score: 60, ts: NOW - 1 * DAY }),
        attempt({ qid: "ra-2", score: 80, ts: NOW - 2 * DAY }),
        attempt({ qid: "ra-3", score: 100, ts: NOW - 10 * DAY }), // fora da janela
      ]),
      NOW,
    );
    expect(r.attemptsCount).toBe(2);
    expect(r.overallAvg).toBe(70);
    expect(r.period.to).toBeTruthy();
  });

  it("delta7d compara com a semana anterior", () => {
    const r = weeklyReport(
      appWith([
        attempt({ qid: "a", score: 80, ts: NOW - 1 * DAY }),
        attempt({ qid: "b", score: 60, ts: NOW - 10 * DAY }),
      ]),
      NOW,
    );
    expect(r.delta7d).toBe(20);
  });

  it("usa a data da prova e o alvo declarados", () => {
    const future = new Date(NOW + 30 * DAY);
    const iso = `${future.getFullYear()}-${`${future.getMonth() + 1}`.padStart(2, "0")}-${`${future.getDate()}`.padStart(2, "0")}`;
    const r = weeklyReport(
      appWith([], { settings: { ...DEFAULT_SETTINGS, examDate: iso, targetScore: 79 } }),
      NOW,
    );
    expect(r.daysToExam).toBe(30);
    expect(r.target).toBe(79);
    expect(r.estimate).toBeNull(); // sem tentativas
  });

  it("agrega padrões de erro da janela (top 5)", () => {
    const mk = (i: number): Attempt =>
      attempt({
        qid: `mcq-${i}`,
        taskType: "mcq_single" as TaskType,
        score: 50,
        metrics: { hits: 0, total: 4 },
      });
    const r = weeklyReport(appWith([mk(1), mk(2), mk(3)]), NOW);
    expect(r.topErrors.length).toBeGreaterThan(0);
    expect(r.topErrors.length).toBeLessThanOrEqual(5);
    expect(r.topErrors.some((t) => t.includes("Conteúdo"))).toBe(true);
  });

  it("conta revisões vencidas via stats", () => {
    // tentativa antiga e fraca de uma questão real do banco → vencida para revisão
    const qid = firstIdOfType("read_aloud");
    expect(qid).toBeTruthy();
    const app = appWith([attempt({ qid: qid as string, score: 50, ts: NOW - 40 * DAY })]);
    const r = weeklyReport(app, NOW);
    expect(r.dueCount).toBeGreaterThanOrEqual(1);
  });
});

describe("renderReportMarkdown", () => {
  it("monta markdown com período, tabela e erros", () => {
    const base: WeeklyReport = weeklyReport(
      appWith([
        attempt({ qid: "a", score: 80, ts: NOW - 1 * DAY }),
        attempt({ qid: "b", score: 60, ts: NOW - 2 * DAY, taskType: "wfd", tags: ["missed:the"] }),
      ]),
      NOW,
    );
    const md = renderReportMarkdown(base);
    expect(md).toContain("# Relatório semanal — PTE Master Hub");
    expect(md).toContain("Período:");
    expect(md).toContain("| Seção | Prontidão | Estimativa | Cobertura |");
    expect(md).toContain("Speaking");
    expect(md).toContain("Média 7 dias: 70%");
    expect(md).toContain("Estimativa de treino:");
  });

  it("estimativa e alvo na mesma linha (10–90), sem % junto", () => {
    const md = renderReportMarkdown(weeklyReport(appWith([attempt({ qid: "a", score: 80 })]), NOW));
    const alvoLine = md.split("\n").find((l) => l.includes("Alvo"));
    expect(alvoLine).toBeTruthy();
    expect(alvoLine).not.toContain("%");
    expect(alvoLine).toContain("Estimativa de treino:");
  });

  it("sem tentativas → mensagem clara em vez de relatório zebra", () => {
    const md = renderReportMarkdown(weeklyReport(appWith([]), NOW));
    expect(md).toContain("Sem tentativas com score nos últimos 7 dias.");
    expect(md).not.toContain("| Seção |");
  });
});

describe("renderReportJson", () => {
  it("gera JSON estável e reparseável", () => {
    const r = weeklyReport(appWith([attempt({ qid: "a", score: 90 })]), NOW);
    const parsed = JSON.parse(renderReportJson(r)) as WeeklyReport & { app: string };
    expect(parsed.app).toBe("pte-master-hub");
    expect(parsed.sections).toHaveLength(4);
    expect(parsed.generatedAt).toBe(r.generatedAt);
  });
});

describe("stats fixture (sanidade do dueCount)", () => {
  it("QuestionStat default vence com dueAt no passado", () => {
    expect(stat().dueAt).toBeLessThan(NOW);
  });
});
