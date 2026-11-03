// Fase 5 — Banco: proveniência, duplicatas, payload (PRD §3.5).
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UnifiedQuestion } from "@/lib/pte";

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

const DAY = 86_400_000;

describe("Proveniência (C2)", () => {
  it("classifica fontes: verificada / ia / comunitária (desconhecida nunca é verificada)", async () => {
    const { sourceClass } = await import("@/lib/pte");
    expect(sourceClass("goarno.io")).toBe("verificada");
    expect(sourceClass("pteacademy.in")).toBe("verificada");
    expect(sourceClass("79score.com")).toBe("verificada");
    expect(sourceClass("ai-generated-prediction")).toBe("ia");
    expect(sourceClass("pte2-prediction")).toBe("ia");
    expect(sourceClass("pteracai-seed")).toBe("ia");
    expect(sourceClass("anki-cards")).toBe("comunitária");
    expect(sourceClass("fonte-nova-nunca-vista")).toBe("comunitária");
  });

  it("o manifesto carrega o selo em toda QuestionMeta", async () => {
    const { allMeta } = await import("@/lib/pte");
    expect(allMeta.length).toBeGreaterThan(2_000);
    expect(allMeta.every((m) => ["verificada", "comunitária", "ia"].includes(m.sourceClass))).toBe(
      true,
    );
  });
});

describe("Dedupe / canonicalId (C3)", () => {
  it("os 28 pares de SWT viram o id canônico goarno-swt-*", async () => {
    const { canonicalIdOf, isDuplicateId } = await import("@/lib/pte");
    expect(canonicalIdOf("pte-swt-00dc6a7a")).toBe("goarno-swt-07");
    expect(canonicalIdOf("goarno-swt-07")).toBe("goarno-swt-07");
    expect(isDuplicateId("pte-swt-00dc6a7a")).toBe(true);
    expect(isDuplicateId("goarno-swt-07")).toBe(false);
    const { allMeta } = await import("@/lib/pte");
    expect(allMeta.filter((m) => m.duplicate)).toHaveLength(28);
    expect(allMeta.filter((m) => m.duplicate).every((m) => m.taskType === "swt")).toBe(true);
  });

  it("mergeSnapshots soma contadores, pega máximos e mantém o 'último' do mais recente", async () => {
    const { mergeSnapshots } = await import("@/lib/storage");
    const a = {
      attempts: 3,
      bestScore: 80,
      bestWpm: 120,
      lastScore: 75,
      lastAttemptAt: DAY,
      strongAttempts: 1,
      dueStrongAttempts: 1,
      prevStrong: false,
      lastAttemptDue: true,
      box: 1,
      dueAt: 2 * DAY,
    };
    const b = {
      attempts: 2,
      bestScore: 90,
      bestWpm: 150,
      lastScore: 95,
      lastAttemptAt: 5 * DAY,
      strongAttempts: 2,
      dueStrongAttempts: 0,
      prevStrong: true,
      lastAttemptDue: false,
      box: 2,
      dueAt: 9 * DAY,
    };
    const merged = mergeSnapshots(a, b);
    expect(merged.attempts).toBe(5);
    expect(merged.bestScore).toBe(90);
    expect(merged.bestWpm).toBe(150);
    expect(merged.strongAttempts).toBe(3);
    expect(merged.dueStrongAttempts).toBe(1);
    expect(merged.box).toBe(2);
    expect(merged.dueAt).toBe(9 * DAY);
    expect(merged.lastScore).toBe(95); // b é o mais recente
    expect(merged.lastAttemptAt).toBe(5 * DAY);
    expect(merged.prevStrong).toBe(true);
    expect(merged.lastAttemptDue).toBe(false);
  });

  it("migração v6 funde o progresso dos pares de duplicatas sem perda (id canônico)", async () => {
    const { migrateLegacyState, computeStats } = await import("@/lib/storage");
    const now = Date.now();
    const doc = {
      version: 6,
      srsRules: 2,
      attempts: [],
      questions: {
        "pte-swt-00dc6a7a": {
          attempts: 2,
          bestScore: 70,
          bestWpm: null,
          lastScore: 70,
          lastAttemptAt: now - DAY,
          strongAttempts: 0,
          dueStrongAttempts: 0,
          prevStrong: false,
          lastAttemptDue: false,
          box: 1,
          dueAt: now - DAY,
        },
        "goarno-swt-07": {
          attempts: 3,
          bestScore: 85,
          bestWpm: null,
          lastScore: 85,
          lastAttemptAt: now,
          strongAttempts: 2,
          dueStrongAttempts: 1,
          prevStrong: true,
          lastAttemptDue: false,
          box: 2,
          dueAt: now + 3 * DAY,
        },
      },
      daily: {},
      bookmarks: ["pte-swt-00dc6a7a", "goarno-swt-07"],
      notes: {
        "pte-swt-00dc6a7a": { text: "antiga", updatedAt: 1 },
        "goarno-swt-07": { text: "recente", updatedAt: 2 },
      },
      sessions: [],
      draft: null,
      settings: {},
    };
    const migrated = migrateLegacyState(doc);
    const keys = Object.keys(migrated.questions);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe("goarno-swt-07");
    const snap = migrated.questions["goarno-swt-07"]!;
    expect(snap.attempts).toBe(5);
    expect(snap.bestScore).toBe(85);
    expect(snap.strongAttempts).toBe(2);
    expect(snap.box).toBe(2);
    expect(snap.dueAt).toBe(now + 3 * DAY);
    expect(snap.lastScore).toBe(85);
    // favoritos e notas seguem o id canônico, sem repetição
    expect(migrated.bookmarks).toEqual(["goarno-swt-07"]);
    expect(migrated.notes["goarno-swt-07"]!.text).toBe("recente");
    // estatísticas ficam sob o id canônico
    const stats = computeStats(migrated);
    expect(stats.get("goarno-swt-07")!.attempts).toBe(5);
    expect(stats.has("pte-swt-00dc6a7a")).toBe(false);
  });

  it("tentativa numa duplicata é contabilizada no id canônico (stats sem divisão)", async () => {
    const { migrateLegacyState, recordAttempt, computeStats, getStateSnapshot } =
      await import("@/lib/storage");
    const now = Date.now();
    const migrated = migrateLegacyState({ version: 6, srsRules: 2, settings: {} });
    recordAttempt({
      qid: "pte-swt-00dc6a7a",
      ts: now,
      taskType: "swt",
      mode: "manual",
      contentScore: 90,
      score: null,
      wpm: null,
      durationMs: 1000,
    });
    const stats = computeStats(getStateSnapshot());
    expect(stats.get("goarno-swt-07")!.attempts).toBe(1);
    expect(stats.has("pte-swt-00dc6a7a")).toBe(false);
    expect(migrated.version).toBe(7);
  });
});

describe("Filas respeitam duplicatas e o filtro de fontes (D4/D7)", () => {
  it("filterQueuePool: duplicatas saem sempre; verifiedOnly deixa só verificadas", async () => {
    const { filterQueuePool } = await import("@/lib/session");
    const { allMeta } = await import("@/lib/pte");
    const filtered = filterQueuePool(allMeta, true);
    expect(filtered.every((m) => !m.duplicate && m.sourceClass === "verificada")).toBe(true);
    const noFilter = filterQueuePool(allMeta, false);
    expect(noFilter.every((m) => !m.duplicate)).toBe(true);
    expect(noFilter.length).toBeGreaterThan(filtered.length);
  });

  it("buildQueue com verifiedOnly só devolve ids verificados e não duplicados", async () => {
    const { buildQueue } = await import("@/lib/session");
    const { allMeta } = await import("@/lib/pte");
    const queue = buildQueue(new Map(), 40, { verifiedOnly: true, rand: () => 0.5 });
    const meta = new Map(allMeta.map((m) => [m.id, m]));
    expect(queue.length).toBeGreaterThan(0);
    expect(
      queue.every((id) => !meta.get(id)!.duplicate && meta.get(id)!.sourceClass === "verificada"),
    ).toBe(true);
  });

  it("buildExamQueue com verifiedOnly só amostra fontes verificadas", async () => {
    const { buildExamQueue } = await import("@/lib/pte/exam");
    const queue = buildExamQueue("listening", () => 0.5, { verifiedOnly: true });
    // Listening NÃO tem fonte verificada: a fila fica vazia em vez de treinar IA
    expect(queue).toHaveLength(0);
  });

  it("o plano do dia respeita o filtro (verifiedOnly => sem estoque de tipos só-IA)", async () => {
    const { buildDailyPlan } = await import("@/lib/pte/studyPlan");
    const { emptyState } = await import("@/lib/storage");
    const stats = new Map();
    const app = { ...emptyState(), attempts: [] };
    const filtered = buildDailyPlan(
      { ...app, settings: { ...app.settings, verifiedOnly: true } },
      stats,
    );
    const open = buildDailyPlan(
      { ...app, settings: { ...app.settings, verifiedOnly: false } },
      stats,
    );
    expect(open.total).toBeGreaterThan(0);
    // sem filtros, tipos só-IA (wfd) têm estoque; com o filtro, não
    expect(open.counts["wfd"] ?? 0).toBeGreaterThan(0);
    expect(filtered.counts["wfd"] ?? 0).toBe(0);
  });
});

describe("Banco pequeno (C4)", () => {
  it("selo para tipos com ≤ 6 itens", async () => {
    const { isSmallBank, typeCounts } = await import("@/lib/pte");
    expect(isSmallBank("lst_hcs")).toBe(true);
    expect(isSmallBank("lst_summary")).toBe(true);
    expect(isSmallBank("wfd")).toBe(false);
    expect(typeCounts["lst_hcs"]).toBeLessThanOrEqual(6);
    expect(typeCounts["wfd"]).toBeGreaterThan(6);
  });
});

describe("Payload (D2) — contrato do leitor", () => {
  it("wfd.json guarda só id/answer/source/word_count — sem text/transcript duplicados", async () => {
    const wfd = (await import("@/data/pte/wfd.json")).default as { questions?: unknown[] };
    const items = (wfd.questions ?? wfd) as Record<string, unknown>[];
    expect(items.length).toBe(934);
    expect(Object.keys(items[0]!).sort()).toEqual(["answer", "id", "source", "word_count"]);
  });

  it("o catálogo deriva WFD (answer) e essay (prompt) sem campo de texto no JSON", async () => {
    const { loadQuestions } = await import("@/lib/pte");
    const [wfd] = await loadQuestions(["wfd"]);
    const w = wfd as Extract<UnifiedQuestion, { answer: string }> | undefined;
    expect(w!.text).toBe(w!.answer);
    expect(w!.transcript).toBe(w!.answer);
    expect(w!.audioText).toBe(w!.answer);
    const [essay] = await loadQuestions(["write_essay"]);
    expect(essay!.text.length).toBeGreaterThan(50);
    expect(essay!.prompt.length).toBeGreaterThan(50);
    expect(essay!.text).toBe(essay!.prompt);
  });

  it("o manifesto continua com 2.618 questões (os 3 tipos da Fase 7 incluídos)", async () => {
    const { TOTAL_ALL_QUESTIONS } = await import("@/lib/pte");
    expect(TOTAL_ALL_QUESTIONS).toBe(2_618);
  });
});
