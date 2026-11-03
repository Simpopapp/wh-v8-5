import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

async function load() {
  return import("@/lib/storage");
}

const readSaved = () =>
  (async () => {
    const { migrateLegacyState, flushPendingWrite } = await import("@/lib/storage");
    flushPendingWrite();
    return migrateLegacyState(JSON.parse(window.localStorage.getItem("pte-master-hub")!));
  })();

describe("Notas por questão (storage v3)", () => {
  it("upsertNote persiste, normaliza (trim) e limita a 2000 caracteres", async () => {
    const storage = await load();
    storage.upsertNote("q1", "  ler devagar no ponto final  ");
    let state = await readSaved();
    expect(state.notes["q1"]!.text).toBe("ler devagar no ponto final");
    expect(state.notes["q1"]!.updatedAt).toBeGreaterThan(0);

    storage.upsertNote("q2", "x".repeat(2500));
    state = await readSaved();
    expect(state.notes["q2"]!.text).toHaveLength(2000);
  });

  it("texto vazio apaga a nota e nota inexistente não cria estado", async () => {
    const storage = await load();
    storage.upsertNote("q1", "nota");
    storage.upsertNote("q1", "   ");
    let state = await readSaved();
    expect(state.notes).toEqual({});

    storage.upsertNote("q1", "");
    state = await readSaved();
    expect(state.notes).toEqual({});
  });

  it("notas entram no backup v3 e reimportam 1:1", async () => {
    const storage = await load();
    storage.upsertNote("pte-ra-1", "armadilha: plural");
    storage.upsertNote("pte-wfd-2", "palavra nova: threshold");
    const backup = storage.exportBackup();
    const parsed = JSON.parse(backup);
    expect(parsed.version).toBe(7);
    expect(Object.keys(parsed.notes)).toHaveLength(2);

    vi.resetModules();
    window.localStorage.clear();
    const fresh = await import("@/lib/storage");
    expect(fresh.importBackup(backup).ok).toBe(true);
    const state = await readSaved();
    expect(state.notes["pte-ra-1"]!.text).toBe("armadilha: plural");
    expect(state.notes["pte-wfd-2"]!.text).toBe("palavra nova: threshold");
  });
});
