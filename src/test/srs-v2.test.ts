// Fase 2 — SRS correto (projeto 9, B5): simulações determinísticas.
// Regras: promoção só com a questão VENCIDA; prática antecipada não promove;
// lapso rebaixa UMA caixa (não zera); limiar de acerto por tipo (D12);
// "dominada" exige tentativas fortes feitas vencidas (gate anti-maratona).

import { describe, expect, it } from "vitest";

import { metaByType, type TaskType } from "@/lib/pte";
import { buildQueue, countDue } from "@/lib/session";
import {
  PASS_SCORE_BY_TYPE,
  SRS_INTERVAL_DAYS,
  computeStats,
  emptyState,
  isMasteredStat,
  migrateLegacyState,
  passScoreFor,
  type AppState,
  type Attempt,
} from "@/lib/storage";

const DAY = 86_400_000;
const MIN = 60_000;
const T0 = 1_800_000_000_000;

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
const stateWith = (attempts: Attempt[]): AppState => ({ ...emptyState(), attempts });
const id = (t: TaskType, i = 0) => metaByType(t)[i]!.id;

describe("Promoção só com a questão vencida (D11)", () => {
  it("probe B5: 5 acertos em 5 minutos → caixa 1, não 5", () => {
    const q = id("wfd");
    const many = Array.from({ length: 5 }, (_, i) => attempt(q, "wfd", 95, T0 + i * MIN));
    const s = computeStats(stateWith(many)).get(q)!;
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(T0 + SRS_INTERVAL_DAYS[1]! * DAY);
    // nada se perde: contadores continuam honestos
    expect(s.attempts).toBe(5);
    expect(s.strongAttempts).toBe(5);
    expect(s.bestContent).toBe(95);
  });

  it("acerto quando vencida promove (intervalos completos)", () => {
    const q = id("wfd");
    const s = computeStats(
      stateWith([
        attempt(q, "wfd", 90, T0),
        attempt(q, "wfd", 90, T0 + SRS_INTERVAL_DAYS[1]! * DAY),
        attempt(q, "wfd", 90, T0 + (SRS_INTERVAL_DAYS[1]! + SRS_INTERVAL_DAYS[2]!) * DAY),
      ]),
    ).get(q)!;
    expect(s.box).toBe(3);
    expect(s.dueAt).toBe(
      T0 + (SRS_INTERVAL_DAYS[1]! + SRS_INTERVAL_DAYS[2]!) * DAY + SRS_INTERVAL_DAYS[3]! * DAY,
    );
  });

  it("prática antecipada registra e NÃO promove, sem empurrar a revisão", () => {
    const q = id("wfd");
    const s = computeStats(
      stateWith([attempt(q, "wfd", 90, T0), attempt(q, "wfd", 95, T0 + 2 * 60_000)]),
    ).get(q)!;
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(T0 + SRS_INTERVAL_DAYS[1]! * DAY);
    expect(s.attempts).toBe(2);
    expect(s.strongAttempts).toBe(2);
    expect(s.lastScore).toBe(95);
  });

  it("a prática antecipada não bloqueia a promoção quando o prazo chega", () => {
    const q = id("wfd");
    const s = computeStats(
      stateWith([
        attempt(q, "wfd", 90, T0),
        attempt(q, "wfd", 95, T0 + 2 * MIN), // antecipada
        attempt(q, "wfd", 95, T0 + SRS_INTERVAL_DAYS[1]! * DAY), // vencida → promove
      ]),
    ).get(q)!;
    expect(s.box).toBe(2);
    expect(s.dueAt).toBe(T0 + SRS_INTERVAL_DAYS[1]! * DAY + SRS_INTERVAL_DAYS[2]! * DAY);
  });

  it("atraso não pune: vencida há 40 dias, acerto promove normalmente", () => {
    const q = id("wfd");
    const s = computeStats(
      stateWith([attempt(q, "wfd", 90, T0), attempt(q, "wfd", 92, T0 + 40 * DAY)]),
    ).get(q)!;
    expect(s.box).toBe(2);
    expect(s.dueAt).toBe(T0 + 40 * DAY + SRS_INTERVAL_DAYS[2]! * DAY);
  });
});

describe("Lapso rebaixa gradualmente (D11)", () => {
  it("falha derruba UMA caixa (não zera) e reagenda pelo intervalo da caixa nova", () => {
    const q = id("wfd");
    const s = computeStats(
      stateWith([
        attempt(q, "wfd", 90, T0),
        attempt(q, "wfd", 90, T0 + SRS_INTERVAL_DAYS[1]! * DAY), // caixa 2
        attempt(q, "wfd", 40, T0 + 4 * DAY + MIN), // lapso
      ]),
    ).get(q)!;
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(T0 + 4 * DAY + MIN + SRS_INTERVAL_DAYS[1]! * DAY);
    expect(s.bestContent).toBe(90);
    expect(s.lastScore).toBe(40);
  });

  it("lapso na caixa 0 fica na caixa 0 e vence no mesmo dia", () => {
    const q = id("wfd");
    const s = computeStats(stateWith([attempt(q, "wfd", 40, T0)])).get(q)!;
    expect(s.box).toBe(0);
    expect(s.dueAt).toBe(T0);
  });
});

describe("Limiar de acerto por tipo (D12)", () => {
  it("ditados exigem 85; retenção de conteúdo aceita 70; o resto 75", () => {
    expect(passScoreFor("wfd")).toBe(85);
    expect(passScoreFor("lst_fib")).toBe(85);
    expect(passScoreFor("read_aloud")).toBe(80);
    expect(passScoreFor("repeat_sentence")).toBe(80);
    expect(passScoreFor("summarize_spoken_text")).toBe(70);
    expect(passScoreFor("retell_lecture")).toBe(70);
    expect(passScoreFor("swt")).toBe(70);
    expect(passScoreFor("write_essay")).toBe(70);
    expect(passScoreFor("lst_summary")).toBe(70);
    // Fase 7: os 3 tipos novos também são retenção de conteúdo falado.
    expect(passScoreFor("summarize_group_discussion")).toBe(70);
    expect(passScoreFor("respond_to_situation")).toBe(70);
    expect(passScoreFor("describe_image")).toBe(70);
    expect(passScoreFor("mcq_single")).toBe(75);
    expect(passScoreFor("answer_short")).toBe(75);
    expect(Object.keys(PASS_SCORE_BY_TYPE)).toHaveLength(22);
  });

  it("82 no ditado é lapso; 75 no retell é acerto", () => {
    const q = id("wfd");
    const ditado = computeStats(stateWith([attempt(q, "wfd", 82, T0)])).get(q)!;
    expect(ditado.box).toBe(0);
    const r = id("retell_lecture");
    const retell = computeStats(stateWith([attempt(r, "retell_lecture", 75, T0)])).get(r)!;
    expect(retell.box).toBe(1);
  });
});

describe("Dominada reavaliada (gate anti-maratona)", () => {
  it("maratona de 5 minutos não domina (mesmo com 5 fortes)", () => {
    const q = id("wfd");
    const many = Array.from({ length: 5 }, (_, i) => attempt(q, "wfd", 95, T0 + i * MIN));
    const s = computeStats(stateWith(many)).get(q)!;
    expect(isMasteredStat(s, "wfd")).toBe(false);
  });

  it("duas revisões fortes feitas vencidas dominam", () => {
    const q = id("wfd");
    const s = computeStats(
      stateWith([
        attempt(q, "wfd", 95, T0),
        attempt(q, "wfd", 92, T0 + SRS_INTERVAL_DAYS[1]! * DAY),
      ]),
    ).get(q)!;
    expect(isMasteredStat(s, "wfd")).toBe(true);
  });

  it("revisão vencida forte + prática antecipada forte não domina ainda (conservador)", () => {
    const q = id("wfd");
    const s = computeStats(
      stateWith([attempt(q, "wfd", 95, T0), attempt(q, "wfd", 95, T0 + 2 * MIN)]),
    ).get(q)!;
    expect(s.strongAttempts).toBe(2);
    expect(isMasteredStat(s, "wfd")).toBe(false);
  });

  it("depois da próxima revisão vencida forte, domina", () => {
    const q = id("wfd");
    const s = computeStats(
      stateWith([
        attempt(q, "wfd", 95, T0),
        attempt(q, "wfd", 95, T0 + 2 * MIN), // antecipada
        attempt(q, "wfd", 95, T0 + SRS_INTERVAL_DAYS[1]! * DAY), // vencida → 2ª forte vencida
      ]),
    ).get(q)!;
    expect(isMasteredStat(s, "wfd")).toBe(true);
  });

  it("Read Aloud mantém o critério de ritmo, agora com o gate de vencidas", () => {
    const q = id("read_aloud");
    const att = (ts: number, wpm: number): Attempt => ({
      ...attempt(q, "read_aloud", 95, ts),
      mode: "speech",
      wpm,
    });
    const s = computeStats(
      stateWith([att(T0, 140), att(T0 + SRS_INTERVAL_DAYS[1]! * DAY, 140)]),
    ).get(q)!;
    expect(isMasteredStat(s, "read_aloud")).toBe(true);
    const slow = computeStats(
      stateWith([att(T0, 80), att(T0 + SRS_INTERVAL_DAYS[1]! * DAY, 80)]),
    ).get(q)!;
    expect(isMasteredStat(slow, "read_aloud")).toBe(false);
  });
});

describe("Fila do dia e plano usam o novo SRS", () => {
  it("prática antecipada NÃO coloca a questão na fila de vencidas", () => {
    const q = id("wfd");
    const stats = computeStats(
      stateWith([attempt(q, "wfd", 90, T0), attempt(q, "wfd", 95, T0 + 2 * MIN)]),
    );
    expect(countDue(stats, T0 + 3 * MIN)).toBe(0);
    expect(
      buildQueue(stats, 10, { now: T0 + 3 * MIN, mode: "due", rand: () => 0.5 }),
    ).not.toContain(q);
  });

  it("questão vencida entra na fila do dia e o plano a prioriza", async () => {
    const { buildDailyPlan } = await import("@/lib/pte/studyPlan");
    const q = id("wfd");
    const stats = computeStats(stateWith([attempt(q, "wfd", 40, T0)]));
    expect(countDue(stats, T0 + 2 * MIN)).toBe(1);
    const plan = buildDailyPlan(
      {
        ...emptyState(),
        settings: { ...emptyState().settings, verifiedOnly: false },
        attempts: [],
      },
      stats,
      T0 + 2 * MIN,
    );
    expect(plan.dueCounts["wfd"]).toBeGreaterThan(0);
  });
});

describe("Migração recalcula as caixas do histórico (sem perder tentativas)", () => {
  /** v6 antigo: snapshot com caixa 5 inflada por maratona + log completo. */
  function oldRuleState(attempts: Attempt[], box: number, dueAt: number): AppState {
    const qid = attempts[0]!.qid;
    return {
      ...emptyState(),
      srsRules: 1 as unknown as 2, // gerado com as regras antigas
      attempts,
      questions: {
        [qid]: {
          attempts: attempts.length,
          bestScore: 95,
          bestWpm: null,
          lastScore: 95,
          lastAttemptAt: attempts[attempts.length - 1]!.ts,
          strongAttempts: attempts.length,
          dueStrongAttempts: 0,
          prevStrong: false,
          lastAttemptDue: false,
          box,
          dueAt,
        },
      },
    };
  }

  it("caixa inflada por maratona é recalculada (5 fortes em 5 min → caixa 1)", () => {
    const q = id("wfd");
    const many = Array.from({ length: 5 }, (_, i) => attempt(q, "wfd", 95, T0 + i * MIN));
    const inflated = oldRuleState(many, 5, T0 + 4 * MIN + 30 * DAY);
    const migrated = migrateLegacyState(JSON.parse(JSON.stringify(inflated)));
    expect(migrated.srsRules).toBe(2);
    const s = migrated.questions[q]!;
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(T0 + SRS_INTERVAL_DAYS[1]! * DAY);
    // nada se perde na migração
    expect(s.attempts).toBe(5);
    expect(s.strongAttempts).toBe(5);
    expect(s.bestScore).toBe(95);
    // idempotente: migrar de novo não muda nada
    const again = migrateLegacyState(JSON.parse(JSON.stringify(migrated)));
    expect(again.questions).toEqual(migrated.questions);
  });

  it("histórico espaçado correto mantém a caixa alta após o recalculo", () => {
    const q = id("wfd");
    const spaced = [
      attempt(q, "wfd", 90, T0),
      attempt(q, "wfd", 90, T0 + SRS_INTERVAL_DAYS[1]! * DAY),
      attempt(q, "wfd", 90, T0 + (SRS_INTERVAL_DAYS[1]! + SRS_INTERVAL_DAYS[2]!) * DAY),
    ];
    const migrated = migrateLegacyState(JSON.parse(JSON.stringify(oldRuleState(spaced, 3, T0))));
    expect(migrated.questions[q]!.box).toBe(3);
  });

  it("log truncado abaixo do snapshot: caixa/prazo antigos são mantidos (nada é inventado)", () => {
    const q = id("wfd");
    const state = oldRuleState([attempt(q, "wfd", 95, T0)], 4, T0 + 30 * DAY);
    const noLog = { ...state, attempts: [] };
    const migrated = migrateLegacyState(JSON.parse(JSON.stringify(noLog)));
    expect(migrated.questions[q]!.box).toBe(4);
    expect(migrated.questions[q]!.attempts).toBe(1);
  });
});
