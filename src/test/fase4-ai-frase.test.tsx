// Projeto 11, Fase 4 — modelo B: card de frase com IA no momento do click
// (tradução completa + dicas intercaladas), fallback honesto e captura.
import { aiCacheStore } from "@/lib/plus/aiCache";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { AI_STATUS_KEY } from "@/lib/plus/aiStatus";
import { splitSentences } from "@/lib/plus/sentences";
import { emptyState, replaceState, getStateSnapshot } from "@/lib/storage";
import readAloudRaw from "@/data/pte/read_aloud.json";

const mockTranslate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/plus/ai-translate.functions", () => ({
  translateAiPhrase: mockTranslate,
}));

const RESULT = {
  translation: "A modelagem climática usa simulações matemáticas complexas.",
  tips: [
    {
      term: "greenhouse gas",
      note: "gás de efeito estufa — termo técnico da área, não tradução literal",
    },
  ],
};

const SENT = "Climate modeling uses complex mathematical simulations.";
const SENTENCES = [SENT, "These models help scientists understand the severity."];

type Raw = Record<string, unknown>;
const RA = (readAloudRaw as { questions?: Raw[] }).questions ?? [];
// questão real do pack com tradução por frase (para o fallback estático)
const raQ = RA.find((q) => q["id"] === "pte-ra-3295efc4") as
  { id: string; text: string } | undefined;
const raSentences = raQ ? splitSentences(raQ.text) : [];

beforeEach(() => {
  window.localStorage.clear();
  replaceState(emptyState());
  aiCacheStore.reset();
  mockTranslate.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("PlusPhraseCard — modelo B com IA", () => {
  it("IA on: expandir mostra tradução completa + dicas intercaladas e captura com engine ai", async () => {
    mockTranslate.mockResolvedValue({ ok: true, result: RESULT });
    render(
      <PlusPhraseCard
        type="reorder_paragraphs"
        qid="ro:1"
        sentences={SENTENCES}
        enabled
        aiEnabled
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: SENT }));

    expect(await screen.findByText(RESULT.translation)).toBeTruthy();
    expect(screen.getByText("greenhouse gas")).toBeTruthy();
    expect(screen.getByText(/gás de efeito estufa/)).toBeTruthy();
    expect(screen.getByText("IA")).toBeTruthy();
    expect(mockTranslate).toHaveBeenCalledWith({
      data: expect.objectContaining({ sentence: SENT, taskType: "reorder_paragraphs" }),
    });
    await waitFor(() => {
      expect(getStateSnapshot().vocabulary.phrases["reorder_paragraphs:ro:1#0"]).toBeDefined();
    });
    const p = getStateSnapshot().vocabulary.phrases["reorder_paragraphs:ro:1#0"]!;
    expect(p.engine).toBe("ai");
    expect(p.literal).toBe(RESULT.translation);
    expect(p.contextual).toBe(
      "greenhouse gas — gás de efeito estufa — termo técnico da área, não tradução literal",
    );
  });

  it("IA sem dicas: a seção de dicas não aparece", async () => {
    mockTranslate.mockResolvedValue({
      ok: true,
      result: { translation: "Tradução sem dicas.", tips: [] },
    });
    render(<PlusPhraseCard type="read_aloud" qid="ra:1" sentences={SENTENCES} enabled aiEnabled />);
    fireEvent.click(await screen.findByRole("button", { name: SENT }));
    expect(await screen.findByText("Tradução sem dicas.")).toBeTruthy();
    expect(screen.queryByLabelText("Dicas de expressões e termos")).toBeNull();
  });

  it("contexto por tipo: reorder envia vizinhos; MCQ envia alternativas", async () => {
    mockTranslate.mockResolvedValue({ ok: true, result: RESULT });
    const opts = ["urbanization", "deforestation", "ocean acidification"];
    render(
      <PlusPhraseCard
        type="mcq_single"
        qid="mc:1"
        sentences={SENTENCES}
        enabled
        aiEnabled
        questionText="Which factor drives the trend?"
        options={opts}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: SENT }));
    await screen.findByText(RESULT.translation);
    expect(mockTranslate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskType: "mcq_single",
        questionText: "Which factor drives the trend?",
        options: opts,
      }),
    });

    cleanup();
    mockTranslate.mockClear();
    render(
      <PlusPhraseCard
        type="reorder_paragraphs"
        qid="ro:2"
        sentences={SENTENCES}
        enabled
        aiEnabled
        neighbors={SENTENCES}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: SENT }));
    await screen.findByText(RESULT.translation);
    expect(mockTranslate).toHaveBeenCalledWith({
      data: expect.objectContaining({ neighbors: SENTENCES }),
    });
  });

  it("falha transitória (rate): fallback estático, chip modo offline e cooldown persistida", async () => {
    if (!raQ) throw new Error("questão de teste ausente");
    mockTranslate.mockResolvedValue({ ok: false, code: "rate", message: "rate limit" });
    render(
      <PlusPhraseCard type="read_aloud" qid={raQ.id} sentences={raSentences} enabled aiEnabled />,
    );
    fireEvent.click(await screen.findByRole("button", { name: raSentences[0]! }));
    expect(await screen.findByText("Dicionário (modo offline)")).toBeTruthy();
    const status = JSON.parse(window.localStorage.getItem(AI_STATUS_KEY) ?? "{}");
    expect(status.cooldownUntil).toBeGreaterThan(Date.now());
  });

  it("402 (credits): pausa persistida e aviso de créditos com fallback estático", async () => {
    if (!raQ) throw new Error("questão de teste ausente");
    mockTranslate.mockResolvedValue({ ok: false, code: "credits", message: "sem créditos" });
    render(
      <PlusPhraseCard type="read_aloud" qid={raQ.id} sentences={raSentences} enabled aiEnabled />,
    );
    fireEvent.click(await screen.findByRole("button", { name: raSentences[0]! }));
    expect(await screen.findByText(/Créditos de IA esgotados/)).toBeTruthy();
    const status = JSON.parse(window.localStorage.getItem(AI_STATUS_KEY) ?? "{}");
    expect(status.pausedAt).not.toBeNull();
  });

  it("offline: usa o dicionário direto, sem chamada de rede", async () => {
    if (!raQ) throw new Error("questão de teste ausente");
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false });
    try {
      render(
        <PlusPhraseCard type="read_aloud" qid={raQ.id} sentences={raSentences} enabled aiEnabled />,
      );
      fireEvent.click(await screen.findByRole("button", { name: raSentences[0]! }));
      expect(await screen.findByText("Dicionário (modo offline)")).toBeTruthy();
      expect(mockTranslate).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(Navigator.prototype, "onLine", original);
    }
  });

  it("hit de cache: reabrir a mesma frase não chama a rede de novo", async () => {
    mockTranslate.mockResolvedValue({ ok: true, result: RESULT });
    render(<PlusPhraseCard type="read_aloud" qid="ra:9" sentences={SENTENCES} enabled aiEnabled />);
    fireEvent.click(await screen.findByRole("button", { name: SENT }));
    await screen.findByText(RESULT.translation);
    const calls = mockTranslate.mock.calls.length;
    fireEvent.click(await screen.findByRole("button", { name: SENT })); // fecha
    fireEvent.click(await screen.findByRole("button", { name: SENT })); // reabre
    await screen.findByText(RESULT.translation);
    expect(mockTranslate.mock.calls.length).toBe(calls);
  });

  it("IA desligada: dicionário do pack, sem rede e sem chip IA", async () => {
    if (!raQ) throw new Error("questão de teste ausente");
    render(<PlusPhraseCard type="read_aloud" qid={raQ.id} sentences={raSentences} enabled />);
    fireEvent.click(await screen.findByRole("button", { name: raSentences[0]! }));
    expect(await screen.findByText("Dicionário")).toBeTruthy();
    expect(mockTranslate).not.toHaveBeenCalled();
  });
});
