// Projeto 11, Fase 7 — pendências herdadas do projeto 10 (Fases 5–6):
// limpar vocabulário em Ajustes, vocabulário na prévia de backup e cartão "Meu vocabulário" na Home.
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { routeTree } from "@/routeTree.gen";
import { clearVocabAll, saveVocabWord, type VocabStore } from "@/lib/plus/vocab";
import { previewBackup } from "@/lib/backup";
import {
  emptyState,
  replaceState,
  getStateSnapshot,
  clearVocabAll as clearVocabAllMutator,
  exportBackup,
} from "@/lib/storage";

const T0 = 1_700_000_000_000;

function buildStore(): VocabStore {
  let store: VocabStore = { words: {}, phrases: {} };
  store = saveVocabWord(store, {
    word: "rigorous",
    literal: "rigoroso",
    source: { type: "read_aloud", qid: "ra:012" },
    ts: T0,
  });
  return store;
}

function renderRoute(path: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
  });
  void router.navigate({ href: path });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  window.localStorage.clear();
  replaceState(emptyState());
});

afterEach(() => {
  cleanup();
});

describe("clearVocabAll (puro)", () => {
  it("apaga palavras e frases do store, só do store", () => {
    const store = buildStore();
    expect(Object.keys(store.words).length).toBe(1);
    const cleared = clearVocabAll(store);
    expect(Object.keys(cleared.words).length).toBe(0);
    expect(Object.keys(cleared.phrases).length).toBe(0);
    // o store original não é mutado
    expect(Object.keys(store.words).length).toBe(1);
  });
});

describe("clearVocabAll (mutador do estado)", () => {
  it("esvazia o vocabulário e preserva o restante do progresso", () => {
    const base = emptyState();
    replaceState({
      ...base,
      vocabulary: buildStore(),
      attempts: [{ qid: "ra:012", ts: T0, taskType: "read_aloud" } as never],
    });
    clearVocabAllMutator();
    const snap = getStateSnapshot();
    expect(Object.keys(snap.vocabulary.words).length).toBe(0);
    expect(Object.keys(snap.vocabulary.phrases).length).toBe(0);
    expect(snap.attempts.length).toBe(1);
    expect(snap.settings.targetScore).toBe(base.settings.targetScore);
  });
});

describe("prévia de backup mostra o vocabulário do arquivo", () => {
  it("conta palavras e frases vindas no envelope v7", () => {
    replaceState({ ...emptyState(), vocabulary: buildStore() });
    const json = exportBackup();
    const result = previewBackup(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.vocabWords).toBe(1);
    expect(result.preview.vocabPhrases).toBe(0);
  });

  it("round-trip 1:1: vocabulário exportado reimporta com o mesmo número de itens", () => {
    let store = buildStore();
    store = saveVocabWord(store, {
      word: "survey",
      literal: "pesquisa",
      source: { type: "swt", qid: "swt:001" },
      ts: T0 + 100,
    });
    replaceState({ ...emptyState(), vocabulary: store });
    const json = exportBackup();
    const result = previewBackup(json);
    if (!result.ok) throw new Error("backup inválido");
    expect(result.preview.vocabWords).toBe(2);
    expect(result.preview.vocabPhrases).toBe(0);
  });
});

describe("Home — cartão Meu vocabulário", () => {
  it("com itens: mostra contagem e atalho para /vocabulary", async () => {
    replaceState({ ...emptyState(), vocabulary: buildStore() });
    renderRoute("/");
    expect(await screen.findByRole("link", { name: /Meu vocabulário/ })).toBeTruthy();
    expect(await screen.findByText(/1 palavra · 0 frase/)).toBeTruthy();
  });

  it("sem itens: convite para traduzir na prática", async () => {
    renderRoute("/");
    expect(await screen.findByText(/Traduza palavras e frases na prática/)).toBeTruthy();
  });
});

describe("Ajustes — limpar vocabulário", () => {
  it("mostra a contagem real e o link para /vocabulary", async () => {
    replaceState({ ...emptyState(), vocabulary: buildStore() });
    renderRoute("/settings");
    expect(await screen.findByText(/Seu vocabulário:/)).toBeTruthy();
    expect(await screen.findByText(/1 palavra · 0 frase/)).toBeTruthy();
    expect(await screen.findByText(/Limpar vocabulário…/)).toBeTruthy();
  });

  it("confirmação diz o que apaga; confirmar esvazia o vocabulário", async () => {
    replaceState({ ...emptyState(), vocabulary: buildStore() });
    renderRoute("/settings");
    fireEvent.click(await screen.findByText("Limpar vocabulário…"));
    expect(await screen.findByText(/Limpar vocabulário\?/)).toBeTruthy();
    expect(screen.getAllByText(/1 palavra/).length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByText("Limpar tudo"));
    await waitFor(() => {
      expect(Object.keys(getStateSnapshot().vocabulary.words).length).toBe(0);
    });
  });

  it("sem itens, a ação fica desabilitada", async () => {
    renderRoute("/settings");
    const btn = await screen.findByText("Limpar vocabulário…");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
