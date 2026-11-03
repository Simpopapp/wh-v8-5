// Projeto 11, Fase 3 — modelo A: card de palavra com IA no momento do click,
// fallback honesto para o dicionário do pack e captura com `engine:"ai"`.
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { PlusWordText } from "@/components/plus/PlusWordText";
import { AI_STATUS_KEY } from "@/lib/plus/aiStatus";
import { aiCacheStore, wordCacheKey, hashKey } from "@/lib/plus/aiCache";
import { emptyState, replaceState, getStateSnapshot } from "@/lib/storage";

const mockTranslate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/plus/ai-translate.functions", () => ({
  translateAiWord: mockTranslate,
}));

const RESULT = {
  word: "rigorous",
  literal: "rigoroso, meticuloso",
  inSentence: {
    translation: "estudo rigoroso da natureza",
    why: "o autor destaca o cuidado metodológico do estudo",
  },
  synonym: {
    common: "severe",
    verdict: "right" as const,
    explanation: "severe soaria punitivo demais neste contexto",
  },
};

const TEXT = "The rigorous study of nature.";
const SOURCE = { type: "read_aloud", qid: "ra:012" };

beforeEach(() => {
  window.localStorage.clear();
  replaceState(emptyState());
  aiCacheStore.reset();
  mockTranslate.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("PlusWordText — modelo A com IA", () => {
  it("IA on: click gera o card com as 3 seções, chip IA e captura com engine ai", async () => {
    mockTranslate.mockResolvedValue({ ok: true, result: RESULT });
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));

    expect(await screen.findByText("rigoroso, meticuloso")).toBeTruthy();
    expect(screen.getByText("Literal")).toBeTruthy();
    expect(screen.getByText(/Aqui, “rigorous” significa/)).toBeTruthy();
    expect(screen.getByText(/Por que não “severe”/)).toBeTruthy();
    expect(screen.getByText("Certo")).toBeTruthy();
    expect(screen.getByText("IA")).toBeTruthy();
    expect(mockTranslate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        word: "rigorous",
        sentence: TEXT,
        taskType: "read_aloud",
      }),
    });
    await waitFor(() => {
      expect(getStateSnapshot().vocabulary.words["rigorous"]).toBeDefined();
    });
    const w = getStateSnapshot().vocabulary.words["rigorous"]!;
    expect(w.engine).toBe("ai");
    expect(w.literal).toBe("rigoroso, meticuloso");
    expect(w.contextual).toBe("estudo rigoroso da natureza");
  });

  it("hit de cache: reabrir não chama a rede de novo", async () => {
    mockTranslate.mockResolvedValue({ ok: true, result: RESULT });
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    await screen.findByText("rigoroso, meticuloso");
    expect(mockTranslate).toHaveBeenCalledTimes(1);
    const calls = mockTranslate.mock.calls.length;

    cleanup();
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    await screen.findByText("rigoroso, meticuloso");
    expect(mockTranslate.mock.calls.length).toBe(calls);
  });

  it("falha transitória (rate): fallback estático, chip modo offline e cooldown persistida", async () => {
    mockTranslate.mockResolvedValue({ ok: false, code: "rate", message: "rate limit" });
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));

    expect(await screen.findByText("rigoroso")).toBeTruthy();
    expect(screen.getByText("Dicionário (modo offline)")).toBeTruthy();
    const status = JSON.parse(window.localStorage.getItem(AI_STATUS_KEY) ?? "{}");
    expect(status.cooldownUntil).toBeGreaterThan(Date.now());
  });

  it("402 (credits): pausa persistida, aviso de créditos e fallback estático", async () => {
    mockTranslate.mockResolvedValue({ ok: false, code: "credits", message: "sem créditos" });
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));

    expect(await screen.findByText(/Créditos de IA esgotados/)).toBeTruthy();
    expect(screen.getByText("rigoroso")).toBeTruthy();
    const status = JSON.parse(window.localStorage.getItem(AI_STATUS_KEY) ?? "{}");
    expect(status.pausedAt).not.toBeNull();
  });

  it("output inválido: fallback estático sem cooldown nem pausa", async () => {
    mockTranslate.mockResolvedValue({ ok: false, code: "invalid", message: "schema" });
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));

    expect(await screen.findByText("rigoroso")).toBeTruthy();
    expect(screen.getByText("Dicionário")).toBeTruthy();
    const status = JSON.parse(window.localStorage.getItem(AI_STATUS_KEY) ?? "{}");
    expect(status.cooldownUntil ?? 0).toBe(0);
    expect(status.pausedAt ?? null).toBeNull();
  });

  it("offline: usa o dicionário direto, sem chamada de rede", async () => {
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false });
    try {
      render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
      fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
      expect(await screen.findByText("rigoroso")).toBeTruthy();
      expect(screen.getByText("Dicionário (modo offline)")).toBeTruthy();
      expect(mockTranslate).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(Navigator.prototype, "onLine", original);
    }
  });

  it("cooldown ativo bloqueia a rede: dicionário direto", async () => {
    window.localStorage.setItem(
      AI_STATUS_KEY,
      JSON.stringify({ cooldownUntil: Date.now() + 60_000, pausedAt: null }),
    );
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    expect(await screen.findByText("rigoroso")).toBeTruthy();
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it("IA desligada: dicionário do pack, sem rede e sem chip IA", async () => {
    render(<PlusWordText text={TEXT} enabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    expect(await screen.findByText("rigoroso")).toBeTruthy();
    expect(screen.getByText("Dicionário")).toBeTruthy();
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it("reabertura com IA reconta o gesto sem duplicar item ou fonte", async () => {
    mockTranslate.mockResolvedValue({ ok: true, result: RESULT });
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    await screen.findByText("✓ Salvo no vocabulário");
    cleanup();

    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    await screen.findByText(/2×/);
    const w = getStateSnapshot().vocabulary.words["rigorous"]!;
    expect(w.seenCount).toBe(2);
    expect(w.sources).toEqual([SOURCE]);
  });

  it("a chave de cache separa frases distintas para a mesma palavra", () => {
    expect(wordCacheKey("rigorous", "a")).toBe(wordCacheKey("rigorous", "a"));
    expect(wordCacheKey("rigorous", "a")).not.toBe(wordCacheKey("rigorous", "b"));
    expect(wordCacheKey("rigorous", "a")).toContain(hashKey("a"));
  });
});
