import { beforeEach, describe, expect, it, vi } from "vitest";

import { shiftDayKey, dayKey } from "@/lib/dates";

vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

/** Carrega storage + backup no MESMO registro de módulos. */
async function load() {
  const storage = await import("@/lib/storage");
  const backup = await import("@/lib/backup");
  return { storage, backup };
}

const DAY = 86_400_000;

/** Estado v5 sintético: 3 tentativas fortes de "q1" (caixa 3) + ruído suficiente.
 *  Espaçadas pelos intervalos do SRS (Fase 2) — promoção exige questão vencida. */
function v5Doc(noise: number) {
  const attempts: Record<string, unknown>[] = [];
  const base = Date.now() - 40 * DAY;
  const spacing = [0, 1, 4]; // caixa 1 (+1 d), caixa 2 (+3 d) → 3ª tentativa vencida
  for (let i = 0; i < 3; i++) {
    attempts.push({
      qid: "q1",
      ts: base + spacing[i]! * DAY,
      taskType: "wfd",
      mode: "manual",
      contentScore: null,
      score: 95,
      wpm: null,
      durationMs: 8000,
    });
  }
  for (let i = 0; i < noise; i++) {
    attempts.push({
      qid: `noise-${i}`,
      ts: base + 3 * DAY + i,
      taskType: "read_aloud",
      mode: "speech",
      contentScore: 70,
      score: 70,
      wpm: 140,
      durationMs: 12000,
    });
  }
  return {
    version: 5,
    attempts,
    bookmarks: [],
    notes: {},
    sessions: [],
    draft: null,
    settings: {},
  };
}

describe("Storage v6 — Fase 1 (integridade do progresso)", () => {
  it("probe A1: o corte do log NÃO apaga o snapshot SRS da questão", async () => {
    const { storage } = await load();
    const migrated = storage.migrateLegacyState(v5Doc(3_500));
    expect(migrated.version).toBe(7);
    // snapshot semeado pelo log COMPLETO (3 tentativas fortes → caixa 3)
    const snap = migrated.questions["q1"]!;
    expect(snap.attempts).toBe(3);
    expect(snap.box).toBe(3);
    expect(snap.strongAttempts).toBe(3);
    expect(snap.bestScore).toBe(95);
    // log truncado (v6: 2.000) — o snapshot continua intacto
    expect(migrated.attempts.length).toBeLessThanOrEqual(storage.MAX_ATTEMPTS);
    expect(migrated.attempts.length).toBeLessThan(3_500);

    // mais uma tentativa gravada: o snapshot de q1 segue coberto
    const stats = storage.computeStats(migrated);
    expect(stats.get("q1")!.box).toBe(3);
    expect(stats.get("q1")!.attempts).toBe(3);
  });

  it("probe A1 (módulo vivo): recordAttempt mantém q1 e trunca só o log", async () => {
    window.localStorage.setItem("pte-master-hub", JSON.stringify(v5Doc(3_500)));
    const { storage } = await load();
    storage.recordAttempt({ qid: "novo", taskType: "wfd", score: 88, mode: "manual" });
    storage.flushPendingWrite();
    const saved = storage.migrateLegacyState(
      JSON.parse(window.localStorage.getItem("pte-master-hub")!),
    );
    expect(saved.questions["q1"]!.box).toBe(3);
    expect(saved.questions["novo"]!.box).toBe(1);
    expect(saved.attempts.length).toBeLessThanOrEqual(storage.MAX_ATTEMPTS);
    const stats = storage.computeStats(saved);
    expect(stats.get("q1")!.bestContent).toBe(95);
  });

  it("probe A2: estado ilegível vai para quarentena e NÃO é sobrescrito", async () => {
    const broken = "{isto não é json";
    window.localStorage.setItem("pte-master-hub", broken);
    await import("@/lib/storage");
    // payload original preservado; cópia bruta em quarentena
    expect(window.localStorage.getItem("pte-master-hub")).toBe(broken);
    expect(window.localStorage.getItem("pte-master-hub-quarantine")).toBe(broken);
  });

  it("probe A2: versão futura fica em modo somente-leitura, byte a byte", async () => {
    const future = JSON.stringify({
      version: 8,
      attempts: [{ qid: "q-futuro", ts: 1, score: 50 }],
      bookmarks: ["x"],
      settings: {},
    });
    window.localStorage.setItem("pte-master-hub", future);
    const { storage } = await load();
    // mutações acontecem, mas NADA é gravado por cima do payload futuro
    storage.recordAttempt({ qid: "q2", taskType: "wfd", score: 90, mode: "manual" });
    storage.flushPendingWrite();
    storage.updateSettings({ dailyGoal: 20 });
    storage.flushPendingWrite();
    expect(window.localStorage.getItem("pte-master-hub")).toBe(future);
    // status exposto para a UI (banner de somente-leitura)
    expect(storage.getStorageStatus()).toBe("future");
  });

  it("round-trip v5 → v6 → export → import preserva tudo campo a campo", async () => {
    const { storage } = await load();
    const migrated = storage.migrateLegacyState({
      ...v5Doc(5),
      bookmarks: ["b1"],
      notes: { q1: { text: "atenção", updatedAt: 5 } },
      sessions: [
        {
          id: "s-1",
          startedAt: 10,
          finishedAt: 20,
          kind: "mixed",
          label: "Mista",
          results: [{ qid: "q1", score: 90, wpm: null }],
        },
      ],
      settings: { dailyGoal: 12, targetScore: 79, examDate: "2026-12-01", accent: "en-GB" },
    });
    // semeia o módulo com o estado migrado e exporta
    window.localStorage.setItem("pte-master-hub", JSON.stringify(migrated));
    vi.resetModules();
    const fresh = await import("@/lib/storage");
    const backup = fresh.exportBackup();
    const parsed = JSON.parse(backup);
    expect(parsed.version).toBe(7);
    expect(parsed.questions["q1"].box).toBe(3);
    expect(parsed.daily).toBeDefined();

    // reimporta em módulo limpo → estado idêntico
    vi.resetModules();
    window.localStorage.clear();
    const again = await import("@/lib/storage");
    const res = again.importBackup(backup);
    expect(res.ok).toBe(true);
    again.flushPendingWrite();
    const restored = again.migrateLegacyState(
      JSON.parse(window.localStorage.getItem("pte-master-hub")!),
    );
    expect(restored.questions).toEqual(migrated.questions);
    expect(restored.bookmarks).toEqual(["b1"]);
    expect(restored.notes["q1"]!.text).toBe("atenção");
    expect(restored.sessions[0]!.label).toBe("Mista");
    expect(restored.settings.dailyGoal).toBe(12);
    expect(restored.settings.targetScore).toBe(79);
  });

  it("import com MESCLAR une progresso sem perder nada do estado atual; undo restaura", async () => {
    const { storage, backup } = await load();
    // estado atual: 1 tentativa de q1 (score 90)
    storage.recordAttempt({ qid: "q1", taskType: "wfd", score: 90, mode: "manual" });
    storage.toggleBookmark("q1");
    storage.flushPendingWrite();

    // backup antigo: q1 fraco + q2 tentada
    const backupJson = JSON.stringify({
      app: "pte-master-hub",
      version: 5,
      exportedAt: "2026-01-01T00:00:00.000Z",
      attempts: [
        {
          qid: "q1",
          ts: Date.now() - DAY,
          taskType: "wfd",
          mode: "manual",
          score: 55,
          contentScore: null,
          wpm: null,
          durationMs: 0,
        },
        {
          qid: "q2",
          ts: Date.now() - DAY,
          taskType: "wfd",
          mode: "manual",
          // ≥ limiar do tipo (85, Fase 2) → a mescla mantém a caixa 1
          score: 88,
          contentScore: null,
          wpm: null,
          durationMs: 0,
        },
      ],
      bookmarks: ["q2"],
      notes: {},
      sessions: [],
      settings: {},
    });

    const preview = backup.previewBackup(backupJson);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.preview.attempts).toBe(2);
    expect(preview.preview.questions).toBe(2);

    const applied = backup.applyBackup(backupJson, "merge");
    expect(applied.ok).toBe(true);
    storage.flushPendingWrite();
    const merged = storage.migrateLegacyState(
      JSON.parse(window.localStorage.getItem("pte-master-hub")!),
    );
    // nada do atual foi perdido: q1 continua com o snapshot melhor das duas fontes
    expect(merged.questions["q1"]!.bestScore).toBe(90);
    expect(merged.questions["q1"]!.attempts).toBe(2);
    expect(merged.questions["q2"]!.box).toBe(1);
    expect(merged.bookmarks.sort()).toEqual(["q1", "q2"]);

    // desfazer restaura exatamente o estado anterior
    expect(backup.undoBackup()).toBe(true);
    storage.flushPendingWrite();
    const undone = storage.migrateLegacyState(
      JSON.parse(window.localStorage.getItem("pte-master-hub")!),
    );
    expect(undone.questions["q2"]).toBeUndefined();
    expect(undone.bookmarks).toEqual(["q1"]);
    expect(undone.questions["q1"]!.attempts).toBe(1);
  });

  it("streak e médias diárias iteram por dia do calendário (imunes a offset)", async () => {
    const { storage } = await load();
    const today = dayKey(Date.now());
    const daily = {
      [today]: { attempts: 2, scored: 2, sum: 160 },
      [shiftDayKey(today, -1)]: { attempts: 1, scored: 1, sum: 85 },
      [shiftDayKey(today, -3)]: { attempts: 1, scored: 1, sum: 70 }, // buraco ontem-2
    };
    const app = { ...storage.emptyState(), daily };
    expect(storage.computeStreak(app)).toBe(2); // hoje + ontem; buraco quebra
    // ontem sem treino: streak conta a partir de ontem
    const app2 = {
      ...storage.emptyState(),
      daily: { ...daily, [shiftDayKey(today, -2)]: { attempts: 3, scored: 3, sum: 240 } },
    };
    delete (app2.daily as Record<string, unknown>)[today];
    expect(storage.computeStreak(app2)).toBe(3); // ontem, -2, -3
    const avg = storage.dailyAverages(app, 4);
    expect(avg).toHaveLength(4);
    expect(avg[3]!.score).toBe(80); // hoje: 160/2
    expect(avg[2]!.score).toBe(85);
    expect(avg[1]!.score).toBeNull();
  });

  it("importBackup guarda UNDO e atualiza lastBackupAt", async () => {
    const { storage, backup } = await load();
    storage.recordAttempt({ qid: "q1", taskType: "wfd", score: 90, mode: "manual" });
    storage.flushPendingWrite();
    const json = storage.exportBackup();
    vi.resetModules();
    window.localStorage.clear();
    const fresh = await import("@/lib/storage");
    const bk = await import("@/lib/backup");
    // estado atual tem conteúdo antes do import
    fresh.recordAttempt({ qid: "q9", taskType: "wfd", score: 50, mode: "manual" });
    fresh.flushPendingWrite();
    const res = fresh.importBackup(json);
    expect(res.ok).toBe(true);
    expect(bk.hasUndoBackup()).toBe(true);
    fresh.flushPendingWrite();
    const saved = fresh.migrateLegacyState(
      JSON.parse(window.localStorage.getItem("pte-master-hub")!),
    );
    expect(saved.settings.lastBackupAt).toBeGreaterThan(0);
    expect(bk.undoBackup()).toBe(true);
    fresh.flushPendingWrite();
    expect(fresh.getStateSnapshot().questions["q9"]).toBeDefined();
  });
});
