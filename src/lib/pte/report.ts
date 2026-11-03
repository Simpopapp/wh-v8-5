// Relatório semanal — puro e testável (decisão D4 do PRD: gerado sob demanda,
// envelope de backup inalterado). Reusa prontidão, estimativa por habilidade
// (Fase 4), comparação 7d, diagnóstico e streak; renderiza markdown pt-BR e
// JSON estável para compartilhar.

import { computeStats, computeStreak, type AppState } from "../storage";
import { periodComparison } from "../progress-analytics";
import { countDue } from "../session";
import { diagnoseAttempts, TAG_LABELS, type ErrorTag } from "./diagnostics";
import { estimateTargetLabel } from "./goal";
import type { Confidence } from "./estimate";
import {
  estimateBySkill,
  overallEstimate,
  readinessBySection,
  type SectionReadiness,
} from "./readiness";
import { SECTION_META, SECTION_ORDER } from "./types";

const DAY = 86_400_000;

export interface ReportSection {
  name: string;
  /** Índice de prontidão 0–100. */
  readiness: number;
  level: string;
  confidence: Confidence;
  /** Estimativa de treino 10–90 da habilidade (null = sem dados). */
  estimate: number | null;
  /** Cobertura do banco (tentadas/total, %). */
  coverage: number;
}

export interface WeeklyReport {
  /** Janela fixa de 7 dias terminando em `now` (datas ISO "YYYY-MM-DD"). */
  period: { from: string; to: string };
  /** Momento da geração (ISO completo). */
  generatedAt: string;
  /** Dias restantes para a prova (null = sem data declarada). */
  daysToExam: number | null;
  /** Estimativa de treino geral (10–90, null = sem dados). */
  estimate: number | null;
  target: number;
  streak: number;
  /** Tentativas com score nos últimos 7 dias. */
  attemptsCount: number;
  /** Média geral dos últimos 7 dias (null = sem dados). */
  overallAvg: number | null;
  /** Variação vs. os 7 dias anteriores (null quando falta um dos períodos). */
  delta7d: number | null;
  sections: ReportSection[];
  /** Padrões de erro mais frequentes no período (rótulos pt-BR, máx. 5). */
  topErrors: string[];
  /** Revisões vencidas agora (SRS). */
  dueCount: number;
}

function isoDay(ts: number): string {
  const d = new Date(ts);
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function weeklyReport(app: AppState, now = Date.now()): WeeklyReport {
  const comparison = periodComparison(app.attempts, now);
  const readiness = readinessBySection(app, now);
  const estimates = estimateBySkill(app, now);
  const diagnostics = diagnoseAttempts(app.attempts.filter((a) => a.ts >= now - 7 * DAY));

  const daysToExam = (() => {
    const { examDate } = app.settings;
    if (!examDate) return null;
    const [y, m, d] = examDate.split("-").map(Number) as [number, number, number];
    const diff = Math.round(
      (new Date(y, m - 1, d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY,
    );
    return diff >= 0 ? diff : null;
  })();

  return {
    period: { from: isoDay(now - 7 * DAY), to: isoDay(now) },
    generatedAt: new Date(now).toISOString(),
    daysToExam,
    estimate: overallEstimate(app, now),
    target: app.settings.targetScore,
    streak: computeStreak(app),
    attemptsCount: comparison.currentCount,
    overallAvg: comparison.current,
    delta7d: comparison.delta,
    sections: SECTION_ORDER.map((section): ReportSection => {
      const r: SectionReadiness | undefined = readiness.find((x) => x.section === section);
      const e = estimates.find((x) => x.skill === section);
      return {
        name: SECTION_META[section].label,
        readiness: r?.score ?? 0,
        level: r?.level ?? "Iniciando",
        confidence: r?.confidence ?? "low",
        estimate: e?.estimate ?? null,
        coverage: r?.coverage ?? 0,
      };
    }),
    topErrors: diagnostics.tags
      .filter((t): t is { tag: ErrorTag; count: number } => t.count > 0)
      .slice(0, 5)
      .map((t) => `${TAG_LABELS[t.tag]} (${t.count})`),
    dueCount: countDue(computeStats(app), now),
  };
}

/** Markdown pt-BR pronto para colar em e-mail/chat/tutor. */
export function renderReportMarkdown(r: WeeklyReport): string {
  const lines: string[] = [];
  lines.push("# Relatório semanal — PTE Master Hub");
  lines.push("");
  lines.push(`Período: ${r.period.from} a ${r.period.to}`);
  const meta: string[] = [];
  if (r.daysToExam !== null) {
    meta.push(r.daysToExam === 0 ? "A prova é hoje!" : `Faltam ${r.daysToExam} dias para a prova`);
  }
  // Estimativa e alvo na MESMA escala (10–90) — a média em % fica em linha própria.
  meta.push(estimateTargetLabel(r.estimate, r.target));
  if (r.streak > 0) meta.push(`Sequência: ${r.streak} dia(s)`);
  lines.push(meta.join(" · "));
  lines.push("");
  if (r.attemptsCount === 0) {
    lines.push("Sem tentativas com score nos últimos 7 dias.");
    lines.push("");
  } else {
    lines.push(
      `Tentativas: ${r.attemptsCount} · Média 7 dias: ${r.overallAvg}%${
        r.delta7d === null ? "" : ` (${r.delta7d >= 0 ? "+" : ""}${r.delta7d} vs. semana anterior)`
      }`,
    );
    lines.push("");
    lines.push("| Seção | Prontidão | Estimativa | Cobertura |");
    lines.push("|---|---|---|---|");
    for (const s of r.sections) {
      lines.push(
        `| ${s.name} | ${s.readiness}/100 (${s.level}) | ${s.estimate ?? "—"} | ${s.coverage}% |`,
      );
    }
    lines.push("");
  }
  if (r.topErrors.length > 0) {
    lines.push(`Padrões de erro: ${r.topErrors.join(", ")}`);
    lines.push("");
  }
  if (r.dueCount > 0) lines.push(`Revisões vencidas: ${r.dueCount}`);
  return lines.join("\n").trim() + "\n";
}

/** JSON estável (datas ISO) para anexar ou processar depois. */
export function renderReportJson(r: WeeklyReport): string {
  return JSON.stringify(
    {
      app: "pte-master-hub",
      kind: "weekly-report",
      period: r.period,
      generatedAt: r.generatedAt,
      daysToExam: r.daysToExam,
      estimate: r.estimate,
      target: r.target,
      streak: r.streak,
      attemptsCount: r.attemptsCount,
      overallAvg: r.overallAvg,
      delta7d: r.delta7d,
      sections: r.sections,
      topErrors: r.topErrors,
      dueCount: r.dueCount,
    },
    null,
    2,
  );
}
