// Projeto 12, Fase 1 — TranslationSheet: container universal dos cards de
// tradução (bottom sheet mobile / painel central desktop). Testa o
// comportamento do container: portal, abertura por tap, fecho por ✕/Esc/scrim,
// devolução de foco ao token de origem e conteúdo word/frase (IA e fallback).
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { splitSentences } from "@/lib/plus/sentences";
import { emptyState, replaceState, getStateSnapshot } from "@/lib/storage";
import readAloudRaw from "@/data/pte/read_aloud.json";

const mockTranslateWord = vi.hoisted(() => vi.fn());
const mockTranslatePhrase = vi.hoisted(() => vi.fn());
vi.mock("@/lib/plus/ai-translate.functions", () => ({
  translateAiWord: mockTranslateWord,
  translateAiPhrase: mockTranslatePhrase,
}));

const WORD_RESULT = {
  word: "rigorous",
  literal: "rigoroso, meticuloso",
  inSentence: {
    translation: "estudo rigoroso da natureza",
    why: "o autor destaca o cuidado metodológico do estudo",
  },
  synonym: { common: "severe", verdict: "right" as const, explanation: "exemplo" },
};

const TEXT = "The rigorous study of nature.";
const SOURCE = { type: "read_aloud", qid: "ra:012" };

type Raw = Record<string, unknown>;
const RA = (readAloudRaw as { questions?: Raw[] }).questions ?? [];
const raQ = RA.find((q) => q["id"] === "pte-ra-3295efc4") as
  { id: string; text: string } | undefined;
const raSentences = raQ ? splitSentences(raQ.text) : [];

beforeEach(() => {
  window.localStorage.clear();
  replaceState(emptyState());
  mockTranslateWord.mockReset();
  mockTranslatePhrase.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("TranslationSheet — container universal (projeto 12)", () => {
  it("palavra com IA: o sheet é um diálogo em portal no body, fora do parágrafo", async () => {
    mockTranslateWord.mockResolvedValue({ ok: true, result: WORD_RESULT });
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));

    const dialog = await screen.findByRole("dialog", { name: "Tradução da palavra" });
    expect(dialog.closest("p")).toBeNull();
    expect(document.body.contains(dialog)).toBe(true);
    expect(await screen.findByText("rigoroso, meticuloso")).toBeTruthy();
    await waitFor(() => {
      expect(getStateSnapshot().vocabulary.words["rigorous"]).toBeDefined();
    });
  });

  it("fecha por ✕ e devolve o foco ao token de origem", async () => {
    mockTranslateWord.mockResolvedValue({ ok: true, result: WORD_RESULT });
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    await screen.findByRole("dialog", { name: "Tradução da palavra" });

    fireEvent.click(screen.getByRole("button", { name: "Fechar tradução" }));
    expect(screen.queryByRole("dialog", { name: "Tradução da palavra" })).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Traduzir rigorous");
  });

  it("fecha por Esc", async () => {
    mockTranslateWord.mockResolvedValue({ ok: true, result: WORD_RESULT });
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    await screen.findByRole("dialog", { name: "Tradução da palavra" });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Tradução da palavra" })).toBeNull();
  });

  it("fecha por toque no scrim", async () => {
    mockTranslateWord.mockResolvedValue({ ok: true, result: WORD_RESULT });
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    await screen.findByRole("dialog", { name: "Tradução da palavra" });

    const scrim = document.querySelector(".scrim-anim");
    expect(scrim).toBeTruthy();
    fireEvent.click(scrim as Element);
    expect(screen.queryByRole("dialog", { name: "Tradução da palavra" })).toBeNull();
  });

  it("frase com IA: o sheet mostra a frase de contexto e a tradução do modelo B", async () => {
    mockTranslatePhrase.mockResolvedValue({
      ok: true,
      result: {
        translation: "A modelagem climática usa simulações matemáticas complexas.",
        tips: [],
      },
    });
    render(
      <PlusPhraseCard
        type="reorder_paragraphs"
        qid="ro:1"
        sentences={["Climate modeling uses complex mathematical simulations."]}
        enabled
        aiEnabled
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Climate modeling uses complex mathematical simulations.",
      }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Tradução da frase" });
    expect(dialog.closest("p")).toBeNull();
    expect(document.body.contains(dialog)).toBe(true);
    expect(dialog.textContent).toContain("Climate modeling uses complex mathematical simulations.");
    expect(
      await screen.findByText("A modelagem climática usa simulações matemáticas complexas."),
    ).toBeTruthy();
  });

  it("frase offline: fallback estático no sheet e captura no vocabulário", async () => {
    mockTranslatePhrase.mockRejectedValue(new Error("offline"));
    render(
      <PlusPhraseCard
        type="read_aloud"
        qid="pte-ra-3295efc4"
        sentences={raSentences}
        enabled
        aiEnabled
      />,
    );
    const first = raSentences[0]!;
    fireEvent.click(await screen.findByRole("button", { name: first }));

    const dialog = await screen.findByRole("dialog", { name: "Tradução da frase" });
    await waitFor(() => {
      expect(dialog.textContent).toContain("Dicionário (modo offline)");
    });
    // O dado do pack carrega em paralelo ao primeiro tap; reabrir a mesma
    // frase reflecte o utilizador real e grava a tradução estática.
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(await screen.findByRole("button", { name: first }));
    await screen.findByRole("dialog", { name: "Tradução da frase" });
    await waitFor(() => {
      expect(Object.keys(getStateSnapshot().vocabulary.phrases).length).toBeGreaterThan(0);
    });
  });
});
