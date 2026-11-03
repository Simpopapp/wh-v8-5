import { beforeEach, describe, expect, it, vi } from "vitest";

// Os imports dinâmicos de storage/session são pesados: sob a suite completa
// (workers em paralelo) o transform pode passar dos 5 s padrão.
vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

/** Carrega storage + session no MESMO registro de módulos (instâncias compartilhadas). */
async function load() {
  const storage = await import("@/lib/storage");
  const session = await import("@/lib/session");
  return { storage, session };
}

const readSaved = () =>
  (async () => {
    const { migrateLegacyState, flushPendingWrite } = await import("@/lib/storage");
    flushPendingWrite();
    return migrateLegacyState(JSON.parse(window.localStorage.getItem("pte-master-hub")!));
  })();

describe("Persistência de sessão (draft retomável)", () => {
  it("grava o draft, limpa e recupera pelo getSessionDraft", async () => {
    const { storage } = await load();
    storage.saveSessionDraft({
      kind: "mixed",
      label: "Mista de 4",
      queue: ["a", "b", "c", "d"],
      index: 2,
      startedAt: 1000,
      results: [
        { qid: "a", score: 80, wpm: null },
        { qid: "b", score: 90, wpm: 130 },
      ],
    });
    const draft = storage.getSessionDraft();
    expect(draft).not.toBeNull();
    expect(draft!.index).toBe(2);
    expect(draft!.kind).toBe("mixed");

    // draft ilegível (fila vazia) é normalizado para null
    storage.saveSessionDraft({
      kind: "srs",
      label: "x",
      queue: [],
      index: 0,
      startedAt: 0,
      results: [],
    });
    expect(storage.getSessionDraft()).toBeNull();

    storage.clearSessionDraft();
    expect(storage.getSessionDraft()).toBeNull();
  });

  it("addSessionRecord arquiva no histórico; sem resultados, não arquiva", async () => {
    const { storage } = await load();
    storage.addSessionRecord({
      startedAt: 1000,
      finishedAt: 2000,
      kind: "srs",
      label: "Sessão de 5",
      results: [{ qid: "a", score: 90, wpm: null }],
    });
    storage.addSessionRecord({
      startedAt: 3000,
      finishedAt: 4000,
      kind: "srs",
      label: "vazia",
      results: [],
    });
    const state = await readSaved();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]!.label).toBe("Sessão de 5");
    expect(state.sessions[0]!.id).toMatch(/^s-/);
  });

  it("retomada: novo módulo session.ts restaura o draft do storage", async () => {
    const storage = await import("@/lib/storage");
    storage.saveSessionDraft({
      kind: "srs",
      label: "Sessão de 10",
      queue: ["q1", "q2", "q3"],
      index: 1,
      startedAt: 1000,
      results: [{ qid: "q1", score: 85, wpm: null }],
    });

    // recarrega os módulos: session.ts hidrata a partir do draft persistido
    vi.resetModules();
    const { storage: storage2, session } = await load();
    expect(session.sessionNextId()).toBe("q2");
    expect(session.sessionFinished()).toBe(false);

    // completa os itens restantes → arquiva e limpa o draft
    session.completeSessionItem({ qid: "q2", score: 95, wpm: null });
    session.completeSessionItem({ qid: "q3", score: 100, wpm: null });
    expect(session.sessionFinished()).toBe(true);
    expect(storage2.getSessionDraft()).toBeNull();

    const state = await readSaved();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]!.kind).toBe("srs");
    expect(state.sessions[0]!.results.map((r) => r.qid)).toEqual(["q1", "q2", "q3"]);

    // endSession após sessão já arquivada não duplica o histórico
    session.endSession();
    const after = await readSaved();
    expect(after.sessions).toHaveLength(1);
  });

  it("endSession encerra no meio e arquiva os resultados parciais uma única vez", async () => {
    const storage = await import("@/lib/storage");
    storage.saveSessionDraft({
      kind: "srs",
      label: "Sessão de 5",
      queue: ["q1", "q2", "q3", "q4", "q5"],
      index: 2,
      startedAt: 1000,
      results: [
        { qid: "q1", score: 80, wpm: null },
        { qid: "q2", score: 70, wpm: null },
      ],
    });
    vi.resetModules();
    const { storage: storage2, session } = await load();
    session.endSession();
    const state = await readSaved();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]!.results).toHaveLength(2);
    expect(storage2.getSessionDraft()).toBeNull();
  });

  it("draft finalizado (index >= fila) é restaurado como sessão concluída", async () => {
    const storage = await import("@/lib/storage");
    storage.saveSessionDraft({
      kind: "errors",
      label: "Revisar erros (2)",
      queue: ["q1", "q2"],
      index: 2,
      startedAt: 1000,
      results: [{ qid: "q1", score: 60, wpm: null }],
    });
    vi.resetModules();
    const { session } = await load();
    expect(session.sessionFinished()).toBe(true);
    expect(session.sessionNextId()).toBeUndefined();
  });
});

describe("Backup v3 (envelope único)", () => {
  it("exporta v3 com notas e sessões e reimporta 1:1", async () => {
    const { storage } = await load();
    storage.upsertNote("pte-ra-abc", "ler devagar");
    storage.addSessionRecord({
      startedAt: 1000,
      finishedAt: 2000,
      kind: "mixed",
      label: "Mista de 3",
      results: [{ qid: "a", score: 75, wpm: null }],
    });
    const backup = storage.exportBackup();
    const parsed = JSON.parse(backup);
    expect(parsed.version).toBe(7);
    expect(parsed.notes["pte-ra-abc"].text).toBe("ler devagar");
    expect(parsed.sessions).toHaveLength(1);

    // importa de volta (mesmo módulo — o importBackup substitui o estado atual)
    vi.resetModules();
    window.localStorage.clear();
    const fresh = await import("@/lib/storage");
    const res = fresh.importBackup(backup);
    expect(res.ok).toBe(true);
    const state = await readSaved();
    expect(state.notes["pte-ra-abc"]).toEqual({
      text: "ler devagar",
      updatedAt: expect.any(Number),
    });
    expect(state.sessions[0]!.label).toBe("Mista de 3");
  });

  it("importBackup aceita backup v2 e migra para v3", async () => {
    const { storage } = await load();
    const v2 = JSON.stringify({
      app: "pte-master-hub",
      version: 2,
      attempts: [],
      bookmarks: ["x"],
      settings: {},
    });
    expect(storage.importBackup(v2).ok).toBe(true);
    const state = await readSaved();
    expect(state.version).toBe(7);
    expect(state.bookmarks).toEqual(["x"]);
  });

  it("upsertNote apaga a nota quando o texto fica vazio", async () => {
    const { storage } = await load();
    storage.upsertNote("q1", "nota");
    storage.upsertNote("q1", "   ");
    const state = await readSaved();
    expect(state.notes).toEqual({});
  });
});

describe("Estado vazio v3", () => {
  it("emptyState retorna a estrutura v3 completa", async () => {
    const { storage } = await load();
    const s = storage.emptyState();
    expect(s.version).toBe(7);
    expect(s.notes).toEqual({});
    expect(s.sessions).toEqual([]);
    expect(s.draft).toBeNull();
  });
});
