// Projeto 13 — Fase 2: Sessões que executam o plano (PRD §4.2).
// Cotas por IDs do plano · validação de qid · pular/reagendar · duração estimada
// coerente com a fila · conceito único de erro.

import { beforeEach, describe, expect, it } from "vitest";

import { getMeta, metaByType, type TaskType } from "@/lib/pte";
import { EXAM_SECONDS } from "@/lib/pte/exam";
import { buildDailyPlan } from "@/lib/pte/studyPlan";
import {
  ERROR_SCORE,
  ERROR_THRESHOLD_BY_TYPE,
  buildMixedQueue,
  completeSessionItem,
  countErrors,
  errorThresholdFor,
  estimateSessionSeconds,
  isErrorStat,
  previewMixedQueue,
  sessionFinished,
  sessionNextId,
  skipSessionItem,
  startErrorsSessionForQids,
  startMixedSession,
} from "@/lib/session";
import {
  computeStats,
  emptyState,
  getSessionDraft,
  type Attempt,
  type QuestionStat,
} from "@/lib/storage";

const DAY = 86_400_000;
// Tentativas no passado: todas as revisões estão vencidas "agora".
const T0 = Date.now() - 200 * DAY;

function attempt(qid: string, taskType: TaskType, score: number, ts: number): Attempt {
  return {
    qid,
    ts,
    taskType,
    mode: "manual",
    contentScore: score,
    score,
    wpm: null,
    durationMs: 1000,
  };
}
const stateWith = (attempts: Attempt[]) => ({ ...emptyState(), attempts });
const id = (t: TaskType, i = 0) => metaByType(t)[i]!.id;

beforeEach(() => {
  window.localStorage.clear();
});

describe("Fase 2 · fila mista executa a recomendação do plano", () => {
  it("plano do dia → a fila contém exatamente as cotas recomendadas por tipo", () => {
    // Estoque vencido: 2 WFD (pior 40, depois 80) + 1 LST-FIB (60).
    const dueWfdWorst = id("wfd", 0);
    const dueWfdOther = id("wfd", 1);
    const dueFib = id("lst_fib", 0);
    const stats = computeStats(
      stateWith([
        attempt(dueWfdWorst, "wfd", 40, T0),
        attempt(dueWfdOther, "wfd", 80, T0),
        attempt(dueFib, "lst_fib", 60, T0),
      ]),
    );
    const now = Date.now();
    const plan = buildDailyPlan(
      { attempts: [], settings: { dailyGoal: 8, verifiedOnly: false } },
      stats,
      now,
    );
    expect(plan.total).toBeGreaterThan(0);
    // O plano recomenda as vencidas: as 3 questões vencidas estão nas cotas.
    expect(plan.dueCounts["wfd"]).toBe(2);
    expect(plan.dueCounts["lst_fib"]).toBe(1);

    startMixedSession(plan.counts, stats, {
      due: plan.dueCounts,
      fresh: plan.newCounts,
    });
    const queue = getSessionDraft()?.queue ?? [];
    expect(queue).toHaveLength(plan.total);
    expect(new Set(queue).size).toBe(queue.length); // sem repetição
    // "Plano X → fila contém X": cada tipo tem exatamente a cota recomendada.
    for (const [type, n] of Object.entries(plan.counts) as [TaskType, number][]) {
      const inQueue = queue.filter((q) => getMeta(q)?.taskType === type).length;
      expect(inQueue).toBe(n);
    }
    // As vencidas recomendadas estão na fila…
    for (const qid of [dueWfdWorst, dueWfdOther, dueFib]) {
      expect(queue).toContain(qid);
    }
    // …e nada de tentado fora do que é vencido (novas = nunca tentadas).
    for (const qid of queue) {
      if (qid === dueWfdWorst || qid === dueWfdOther || qid === dueFib) continue;
      expect(stats.has(qid)).toBe(false);
    }
    // Dentro de cada tipo, as vencidas vêm antes das novas (round-robin
    // intercala TIPOS, não categorias).
    const typeSeq = (type: TaskType) => queue.filter((q) => getMeta(q)?.taskType === type);
    const wfdSeq = typeSeq("wfd");
    expect(wfdSeq.slice(0, 2)).toEqual([dueWfdWorst, dueWfdOther]); // pior score primeiro
    expect(typeSeq("lst_fib")[0]).toBe(dueFib);
  });

  it("sem cota, preview == fila real (mesma composição, duração coerente)", () => {
    const stats = new Map<string, QuestionStat>();
    const counts = { wfd: 2, lst_fib: 1 } as const;
    const preview = previewMixedQueue(counts, stats, false);
    startMixedSession(counts, stats);
    expect(getSessionDraft()?.queue).toEqual(preview.ids);
    expect(getSessionDraft()?.queue).toHaveLength(3);
  });

  it("cota maior que o estoque: fallback completa o tipo e o déficit é reportado", () => {
    const dueOnly = id("wfd", 0);
    const stats = computeStats(stateWith([attempt(dueOnly, "wfd", 40, T0)]));
    const info = buildMixedQueue(stats, { wfd: 3 }, undefined, { due: { wfd: 3 } });
    expect(info.ids).toHaveLength(3);
    expect(info.ids).toContain(dueOnly);
    expect(info.dueShort).toBe(2); // "vencidas disponíveis: 1 de 3"
    // A primeira vencida vem antes (pior último score primeiro).
    expect(info.ids[0]).toBe(dueOnly);
  });
});

describe("Fase 2 · completeSessionItem valida o qid", () => {
  it("resultado de outra questão não avança a sessão", () => {
    const a = id("wfd", 0);
    const b = id("wfd", 1);
    startErrorsSessionForQids([a, b]);
    expect(sessionNextId()).toBe(a);

    completeSessionItem({ qid: "outra-questao", score: 50, wpm: null });
    expect(sessionNextId()).toBe(a); // não avançou
    expect(getSessionDraft()?.results).toHaveLength(0);

    completeSessionItem({ qid: a, score: 90, wpm: null });
    expect(sessionNextId()).toBe(b);
    expect(getSessionDraft()?.results).toEqual([{ qid: a, score: 90, wpm: null }]);
  });
});

describe("Fase 2 · pular/reagendar", () => {
  it("pular com motivo reagenda no fim, sem resultado e sem penalidade", () => {
    const a = id("wfd", 0);
    const b = id("wfd", 1);
    const c = id("lst_fib", 0);
    startErrorsSessionForQids([a, b, c]);

    skipSessionItem("asr");
    expect(sessionNextId()).toBe(b);
    const draft = getSessionDraft();
    expect(draft?.queue).toEqual([b, c, a]);
    expect(draft?.results).toHaveLength(0);
    expect(draft?.skips).toBe(1);

    // A pulada volta: completando b e c, ela reaparece como atual.
    completeSessionItem({ qid: b, score: 88, wpm: null });
    completeSessionItem({ qid: c, score: 92, wpm: null });
    expect(sessionNextId()).toBe(a);
    expect(getSessionDraft()?.results.map((r) => r.qid)).toEqual([b, c]);
  });

  it("pular a última restante encerra sem registrar resultado para ela", () => {
    const a = id("wfd", 0);
    startErrorsSessionForQids([a]);
    skipSessionItem("technical");
    expect(sessionFinished()).toBe(true);
    expect(getSessionDraft()).toBeNull();
    expect(sessionNextId()).toBeUndefined();
  });
});

describe("Fase 2 · duração estimada coerente com a fila", () => {
  it("soma os tempos oficiais das questões da fila", () => {
    const ra = id("read_aloud", 0);
    const wfd = id("wfd", 0);
    expect(estimateSessionSeconds([ra, wfd])).toBe(EXAM_SECONDS.read_aloud + EXAM_SECONDS.wfd);
  });

  it("a sessão iniciada dura o que o preview exibiu", () => {
    const stats = new Map<string, QuestionStat>();
    const counts = { wfd: 2, read_aloud: 1 } as const;
    const preview = previewMixedQueue(counts, stats, false);
    startMixedSession(counts, stats);
    const queue = getSessionDraft()?.queue ?? [];
    expect(estimateSessionSeconds(queue)).toBe(estimateSessionSeconds(preview.ids));
  });
});

describe("Fase 2 · conceito único de erro (limiar por tipo)", () => {
  it("o limiar por tipo vale igual em 'revisar erros' e no modo misto", () => {
    const q = id("wfd", 0);
    const s75 = computeStats(stateWith([attempt(q, "wfd", 75, T0)])).get(q)!;
    ERROR_THRESHOLD_BY_TYPE["wfd"] = 80;
    expect(errorThresholdFor("wfd")).toBe(80);
    expect(isErrorStat(s75, "wfd")).toBe(true);
    expect(isErrorStat(s75, "lst_fib")).toBe(false); // mesmo score, outro limiar
    expect(countErrors(computeStats(stateWith([attempt(q, "wfd", 75, T0)])))).toBe(1);
    delete ERROR_THRESHOLD_BY_TYPE["wfd"];
    expect(errorThresholdFor("wfd")).toBe(ERROR_SCORE);
    expect(isErrorStat(s75, "wfd")).toBe(false);
  });
});
