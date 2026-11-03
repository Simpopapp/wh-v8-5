// Projeto 10, Fase 2 — captura: toda tradução exibida vira item do vocabulário.
// A lógica central do planejamento: se o aluno clicou para traduzir, quer estudá-la.
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { splitSentences } from "@/lib/plus/sentences";
import { vocabPhraseKey, vocabWordKey, vocabCounts } from "@/lib/plus/vocab";
import { emptyState, replaceState, getStateSnapshot, updateSettings } from "@/lib/storage";
import readAloudRaw from "@/data/pte/read_aloud.json";

beforeEach(() => {
  window.localStorage.clear();
  replaceState(emptyState());
});

afterEach(() => {
  cleanup();
});

type Raw = Record<string, unknown>;
const RA = (readAloudRaw as { questions?: Raw[] }).questions ?? [];
// questão real do pack com tradução por frase (alinhada por splitSentences)
const raQ = RA.find((q) => q["id"] === "pte-ra-3295efc4") as
  { id: string; text: string } | undefined;
const raSentences = raQ ? splitSentences(raQ.text) : [];

describe("PlusWordText — captura por palavra", () => {
  it("traduzir uma palavra salva no vocabulário com literal + fonte da questão", async () => {
    render(
      <PlusWordText
        text="The rigorous study of nature."
        enabled
        source={{ type: "read_aloud", qid: "ra:012" }}
      />,
    );
    const word = await screen.findByRole("button", { name: "Traduzir rigorous" });
    fireEvent.click(word);
    await waitFor(() => {
      const saved = getStateSnapshot().vocabulary.words["rigorous"];
      expect(saved).toBeDefined();
    });
    const w = getStateSnapshot().vocabulary.words["rigorous"]!;
    expect(w.literal).toBe("rigoroso");
    expect(w.sources).toEqual([{ type: "read_aloud", qid: "ra:012" }]);
    expect(w.seenCount).toBe(1);
    // confirmação discreta no balão
    expect(await screen.findByText(/Salvo no vocabulário/)).toBeTruthy();
  });

  it("re-traduzir a mesma palavra em OUTRA questão mescla fontes e reconta o gesto", async () => {
    render(
      <PlusWordText
        text="The rigorous study of nature."
        enabled
        source={{ type: "read_aloud", qid: "ra:012" }}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    await waitFor(() => {
      expect(getStateSnapshot().vocabulary.words["rigorous"]).toBeDefined();
    });
    cleanup();
    render(
      <PlusWordText
        text="A rigorous analysis was required."
        enabled
        source={{ type: "swt", qid: "swt:034" }}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    await waitFor(() => {
      expect(getStateSnapshot().vocabulary.words["rigorous"]!.seenCount).toBe(2);
    });
    const w = getStateSnapshot().vocabulary.words["rigorous"]!;
    expect(w.sources.map((s) => s.qid)).toEqual(["ra:012", "swt:034"]);
    expect(screen.getByText(/2×/)).toBeTruthy();
  });

  it("palavra SEM tradução no glossário NÃO salva nada (estado vazio honesto)", async () => {
    render(
      <PlusWordText
        text="Blibbertyfrobz of nature."
        enabled
        source={{ type: "read_aloud", qid: "ra:012" }}
      />,
    );
    const word = await screen.findByRole("button", { name: "Traduzir Blibbertyfrobz" });
    fireEvent.click(word);
    expect(await screen.findByText("Tradução não disponível para esta palavra.")).toBeTruthy();
    expect(vocabCounts(getStateSnapshot().vocabulary).total).toBe(0);
  });

  it("vocabCapture desligado em Ajustes → nada é salvo, nada de confirmação", async () => {
    updateSettings({ plus: { ...getStateSnapshot().settings.plus, vocabCapture: false } });
    render(
      <PlusWordText
        text="The rigorous study of nature."
        enabled
        source={{ type: "read_aloud", qid: "ra:012" }}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    expect(await screen.findByText("rigoroso")).toBeTruthy();
    expect(getStateSnapshot().vocabulary.words[vocabWordKey("rigorous")]).toBeUndefined();
    expect(screen.queryByText(/Salvo no vocabulário/)).toBeNull();
  });

  it("sem source (contexto desconhecido) a tradução segue sem captura", async () => {
    render(<PlusWordText text="The rigorous study of nature." enabled />);
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    expect(await screen.findByText("rigoroso")).toBeTruthy();
    expect(vocabCounts(getStateSnapshot().vocabulary).total).toBe(0);
  });
});

describe("PlusPhraseCard — captura por frase", () => {
  it("expandir a frase salva en + tradução + origem (type:qid#índice)", async () => {
    if (!raQ || raSentences.length === 0) throw new Error("questão de teste ausente no banco");
    render(<PlusPhraseCard type="read_aloud" qid={raQ.id} sentences={raSentences} enabled />);
    // primeira frase EN aparece como botão expansível (dados chegam por import dinâmico)
    const first = await waitFor(() => {
      const b = screen
        .getAllByRole("button")
        .find((x) => x.textContent?.includes(raSentences[0]!.slice(0, 20)));
      expect(b).toBeTruthy();
      return b!;
    });
    fireEvent.click(first!);
    await waitFor(() => {
      const saved = getStateSnapshot().vocabulary.phrases[vocabPhraseKey("read_aloud", raQ.id, 0)];
      expect(saved).toBeDefined();
    });
    const p = getStateSnapshot().vocabulary.phrases[vocabPhraseKey("read_aloud", raQ.id, 0)]!;
    expect(p.en).toBe(raSentences[0]);
    expect(p.literal).toBe(
      "A transição de economias baseadas na agricultura para economias industriais no século XIX alterou fundamentalmente os padrões de assentamento humano.",
    );
    expect(screen.getByText(/Salvo no vocabulário/)).toBeTruthy();
  });

  it("recodificar a mesma frase (re-expandir) reconta o gesto sem duplicar", async () => {
    if (!raQ) throw new Error("questão de teste ausente no banco");
    render(<PlusPhraseCard type="read_aloud" qid={raQ.id} sentences={raSentences} enabled />);
    const first = await waitFor(() => {
      const b = screen
        .getAllByRole("button")
        .find((x) => x.textContent?.includes(raSentences[0]!.slice(0, 20)));
      expect(b).toBeTruthy();
      return b!;
    });
    fireEvent.click(first!);
    await waitFor(() => {
      expect(
        getStateSnapshot().vocabulary.phrases[vocabPhraseKey("read_aloud", raQ.id, 0)],
      ).toBeDefined();
    });
    fireEvent.click(first!); // fecha
    fireEvent.click(first!); // reabre — 2º gesto
    await waitFor(() => {
      expect(
        getStateSnapshot().vocabulary.phrases[vocabPhraseKey("read_aloud", raQ.id, 0)]!.seenCount,
      ).toBe(2);
    });
    expect(Object.keys(getStateSnapshot().vocabulary.phrases).length).toBe(1);
  });
});
