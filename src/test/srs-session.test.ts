import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMeta, metaByType, type TaskType } from "@/lib/pte";
import { buildQueue, countDue, countErrors, interleaveByType } from "@/lib/session";
import {
  SRS_INTERVAL_DAYS,
  computeStats,
  emptyState,
  isMasteredStat,
  type Attempt,
} from "@/lib/storage";

const DAY = 86_400_000;
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
const stateWith = (attempts: Attempt[]) => ({ ...emptyState(), attempts });
const id = (t: TaskType, i = 0) => metaByType(t)[i]!.id;

describe("Repetição espaçada (Leitner) em computeStats", () => {
  it("acerto sobe de caixa e agenda a revisão pelo intervalo da caixa", () => {
    const q = id("wfd");
    const s = computeStats(
      stateWith([attempt(q, "wfd", 90, T0), attempt(q, "wfd", 95, T0 + DAY)]),
    ).get(q)!;
    expect(s.box).toBe(2);
    expect(s.dueAt).toBe(T0 + DAY + SRS_INTERVAL_DAYS[2] * DAY);
    expect(s.lastScore).toBe(95);
    expect(s.strongAttempts).toBe(2);
  });

  it("lapso rebaixa UMA caixa (Fase 2) e reagenda pelo intervalo da caixa nova", () => {
    const q = id("wfd");
    const s = computeStats(
      stateWith([
        attempt(q, "wfd", 90, T0),
        attempt(q, "wfd", 95, T0 + DAY),
        attempt(q, "wfd", 40, T0 + 2 * DAY),
      ]),
    ).get(q)!;
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(T0 + 2 * DAY + SRS_INTERVAL_DAYS[1]! * DAY);
    expect(s.bestContent).toBe(95);
    expect(s.lastScore).toBe(40);
  });

  it("não depende da ordem das tentativas no array (backup importado)", () => {
    const q = id("lst_fib");
    const a = attempt(q, "lst_fib", 40, T0);
    const b = attempt(q, "lst_fib", 95, T0 + DAY);
    expect(computeStats(stateWith([b, a])).get(q)!.lastScore).toBe(95);
  });

  it("a caixa nunca passa da última (revisões feitas no prazo de cada caixa)", () => {
    const q = id("wfd");
    const attempts: Attempt[] = [];
    let ts = T0;
    for (let box = 0; box < SRS_INTERVAL_DAYS.length; box++) {
      attempts.push(attempt(q, "wfd", 100, ts));
      ts += SRS_INTERVAL_DAYS[Math.min(box + 1, SRS_INTERVAL_DAYS.length - 1)]! * DAY;
    }
    expect(computeStats(stateWith(attempts)).get(q)!.box).toBe(SRS_INTERVAL_DAYS.length - 1);
  });
});

describe("isMasteredStat por task type", () => {
  it("tipos não-Speaking dominam com 2 tentativas fortes e a última forte", () => {
    const q = id("wfd");
    const one = computeStats(stateWith([attempt(q, "wfd", 95, T0)])).get(q)!;
    expect(isMasteredStat(one, "wfd")).toBe(false);
    const two = computeStats(
      stateWith([attempt(q, "wfd", 95, T0), attempt(q, "wfd", 92, T0 + DAY)]),
    ).get(q)!;
    expect(isMasteredStat(two, "wfd")).toBe(true);
    const regress = computeStats(
      stateWith([
        attempt(q, "wfd", 95, T0),
        attempt(q, "wfd", 92, T0 + DAY),
        attempt(q, "wfd", 50, T0 + 2 * DAY),
      ]),
    ).get(q)!;
    expect(isMasteredStat(regress, "wfd")).toBe(false);
  });

  it("Read Aloud mantém o critério original (conteúdo ≥ 90 + ritmo 120–160), com 2 vencidas fortes", () => {
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

describe("buildQueue (fila inteligente)", () => {
  const rand = () => 0.5;

  it("sem histórico: só questões novas, intercaladas entre task types, sem repetir", () => {
    const q = buildQueue(new Map(), 12, { rand });
    expect(q).toHaveLength(12);
    expect(new Set(q).size).toBe(12);
    // 16 task types prontos → as 12 primeiras vêm de 12 tipos diferentes (round-robin)
    expect(new Set(q.map((x) => getMeta(x)!.taskType)).size).toBe(12);
  });

  it("revisões vencidas vêm antes das novas (2:1) e as de pior score primeiro", () => {
    const worst = id("wfd", 0);
    const mid = id("lst_fib", 0);
    const stats = computeStats(
      stateWith([attempt(worst, "wfd", 20, T0), attempt(mid, "lst_fib", 60, T0)]),
    );
    const q = buildQueue(stats, 6, { now: T0 + DAY, rand });
    expect(q.slice(0, 2)).toEqual([worst, mid]);
    expect(countDue(stats, T0 + DAY)).toBe(2);
    // a 3ª é nova
    expect(stats.has(q[2]!)).toBe(false);
  });

  it("questão ainda não vencida só entra depois das novas", () => {
    const fresh = id("wfd", 0);
    const strong = id("lst_fib", 0);
    const stats = computeStats(stateWith([attempt(strong, "lst_fib", 100, T0)]));
    const q = buildQueue(stats, 5000, { now: T0 + 1000, rand });
    expect(q.indexOf(strong)).toBe(q.length - 1);
    expect(q).toContain(fresh);
  });

  it("modo errors: só última tentativa < 70, pior primeiro; respeita size e taskTypes", () => {
    const a = id("wfd", 0);
    const b = id("wfd", 1);
    const c = id("lst_fib", 0);
    const stats = computeStats(
      stateWith([
        attempt(a, "wfd", 30, T0),
        attempt(b, "wfd", 65, T0),
        attempt(c, "lst_fib", 95, T0),
      ]),
    );
    expect(countErrors(stats)).toBe(2);
    expect(buildQueue(stats, 10, { mode: "errors" })).toEqual([a, b]);
    expect(buildQueue(stats, 1, { mode: "errors" })).toEqual([a]);
    expect(buildQueue(stats, 10, { mode: "errors", taskTypes: ["lst_fib"] })).toEqual([]);
  });

  it("interleaveByType alterna os tipos preservando a ordem interna", () => {
    const out = interleaveByType([
      { taskType: "wfd" as TaskType, n: 1 },
      { taskType: "wfd" as TaskType, n: 2 },
      { taskType: "lst_fib" as TaskType, n: 3 },
    ]);
    expect(out.map((x) => x.n)).toEqual([1, 3, 2]);
  });
});

describe("Storage: migração da chave antiga", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it("lê 'readaloud-trainer-v1', grava em 'pte-master-hub' e apaga a antiga", async () => {
    window.localStorage.setItem(
      "readaloud-trainer-v1",
      JSON.stringify({
        version: 1,
        attempts: [{ qid: "x", ts: T0, mode: "speech", contentScore: 80, wpm: 130, durationMs: 1 }],
        bookmarks: ["x"],
        settings: { dailyGoal: 7, accent: "en-GB" },
      }),
    );
    const mod = await import("@/lib/storage");
    expect(window.localStorage.getItem("readaloud-trainer-v1")).toBeNull();
    const saved = JSON.parse(window.localStorage.getItem("pte-master-hub")!);
    expect(saved.version).toBe(7);
    expect(saved.attempts).toHaveLength(1);
    expect(saved.settings.dailyGoal).toBe(7);
    expect(mod.MAX_ATTEMPTS).toBeGreaterThan(1000);
  });

  it("estado ilegível não derruba o app", async () => {
    window.localStorage.setItem("pte-master-hub", "{não é json");
    await expect(import("@/lib/storage")).resolves.toBeDefined();
  });
});
