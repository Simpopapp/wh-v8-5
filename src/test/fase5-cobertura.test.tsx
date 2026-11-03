// Projeto 11, Fase 5 — cobertura nos 22 tipos: os motores novos ancoram o
// mecanismo certo (word/phrase) com o taskType correto. A montagem dos
import { aiCacheStore } from "@/lib/plus/aiCache";
// próprios motores em fluxo real fica no gate de Playwright amostral.
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { emptyState, replaceState } from "@/lib/storage";

const mockWord = vi.hoisted(() => vi.fn());
const mockPhrase = vi.hoisted(() => vi.fn());
vi.mock("@/lib/plus/ai-translate.functions", () => ({
  translateAiWord: mockWord,
  translateAiPhrase: mockPhrase,
}));

const RESULT = {
  translation: "Tradução completa da frase.",
  tips: [{ term: "termo", note: "explicação da expressão" }],
};
const WORD_RESULT = {
  word: "carefully",
  literal: "cuidadosamente",
  inSentence: { translation: "de forma cuidadosa", why: "modo do verbo" },
  synonym: { common: "cautiously", verdict: "right" as const, explanation: "troca aceitável" },
};

const WORD_TYPES = [
  "repeat_sentence",
  "retell_lecture",
  "answer_short",
  "respond_to_situation",
  "summarize_group_discussion",
  "lst_fib",
  "lst_hiw",
  "summarize_spoken_text",
  "lst_summary",
  "describe_image",
] as const;

const PHRASE_TYPES = [
  "repeat_sentence",
  "retell_lecture",
  "answer_short",
  "respond_to_situation",
  "summarize_group_discussion",
  "lst_hiw",
  "summarize_spoken_text",
  "lst_summary",
] as const;

beforeEach(() => {
  window.localStorage.clear();
  replaceState(emptyState());
  aiCacheStore.reset();
  mockWord.mockReset().mockResolvedValue({ ok: true, result: WORD_RESULT });
  mockPhrase.mockReset().mockResolvedValue({ ok: true, result: RESULT });
});

afterEach(() => {
  cleanup();
});

describe("Fase 5 — mecanismo IA por tipo de questão", () => {
  it.each(WORD_TYPES)("palavra: taskType %s chega ao gateway com o foco do tipo", async (type) => {
    const text = "The librarian organized the archive carefully.";
    render(<PlusWordText text={text} enabled aiEnabled source={{ type, qid: `${type}:1` }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir carefully" }));
    await screen.findByText("cuidadosamente");
    await waitFor(() => {
      expect(mockWord).toHaveBeenCalledWith({
        data: expect.objectContaining({ word: "carefully", taskType: type }),
      });
    });
  });

  it.each(PHRASE_TYPES)("frase: taskType %s chega ao gateway com o foco do tipo", async (type) => {
    const sentence = "The librarian organized the archive carefully.";
    render(
      <PlusPhraseCard type={type} qid={`${type}:1`} sentences={[sentence]} enabled aiEnabled />,
    );
    fireEvent.click(await screen.findByRole("button", { name: sentence }));
    await screen.findByText(RESULT.translation);
    await waitFor(() => {
      expect(mockPhrase).toHaveBeenCalledWith({
        data: expect.objectContaining({ sentence, taskType: type }),
      });
    });
  });
});
