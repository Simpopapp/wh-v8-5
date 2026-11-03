// Fase 4 (projeto 6) + projeto 7 — integração dos 3 recursos do pack studie-plus,
// incluindo a regressão do balão portallado do PlusWordText e a REGRA DO ÁUDIO:
// o pack nunca fala pt-BR — áudio é sempre a pronúncia do texto ORIGINAL em
// inglês, independente dos toggles de tradução.
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { lookupPhrase } from "@/lib/plus/phrases";
import type { PhraseData } from "@/lib/plus/phrases";
import { splitSentences } from "@/lib/plus/sentences";

// ---------------- stub do Web Speech (para observar o que é falado) --------
type Spoken = { text: string; lang: string };
let spoken: Spoken[] = [];

class FakeUtterance {
  text: string;
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function stubSpeech() {
  spoken = [];
  Object.defineProperty(window, "speechSynthesis", {
    writable: true,
    configurable: true,
    value: {
      getVoices: () => [{ lang: "en-US", name: "Test Voice" } as SpeechSynthesisVoice],
      speak: (u: FakeUtterance) => spoken.push({ text: u.text, lang: u.lang }),
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    writable: true,
    configurable: true,
    value: FakeUtterance,
  });
}

describe("PlusWordText — balão portallado", () => {
  it("desativado: parágrafo comum, sem botões de palavra", () => {
    render(<PlusWordText text="The city grew fast." enabled={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
  });

  it("ativado: tap abre dialog portallado fora do parágrafo (sem nesting inválido)", async () => {
    const { container } = render(<PlusWordText text="The city grew fast." enabled />);
    // glossário carrega async; com vazio, palavras ainda são alvos de toque
    const targets = await screen.findAllByRole("button", { name: /Traduzir / });
    expect(targets.length).toBeGreaterThan(0);

    // o dialog não pode estar dentro do <p> (DOM nesting warning do Read FIB)
    const p = container.querySelector("p");
    expect(p).not.toBeNull();

    await act(async () => {
      fireEvent.click(targets[0]!);
    });
    const dialog = screen.getByRole("dialog", { name: "Tradução da palavra" });
    expect(p?.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
    cleanup();
  });

  it("tap no ✕ fecha o balão", async () => {
    render(<PlusWordText text="The city grew fast." enabled />);
    const targets = await screen.findAllByRole("button", { name: /Traduzir / });
    await act(async () => {
      fireEvent.click(targets[0]!);
    });
    expect(screen.getByRole("dialog", { name: "Tradução da palavra" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fechar tradução" }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
  });

  it("Esc fecha o balão", async () => {
    render(<PlusWordText text="The city grew fast." enabled />);
    const targets = await screen.findAllByRole("button", { name: /Traduzir / });
    await act(async () => {
      fireEvent.click(targets[0]!);
    });
    expect(screen.getByRole("dialog", { name: "Tradução da palavra" })).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
  });
});

describe("PlusPhraseCard — tradução por frase", () => {
  const sentences = splitSentences("First sentence. Second one!");

  it("enabled=false → nada renderiza (off por padrão)", () => {
    render(<PlusPhraseCard type="read_aloud" qid="q1" sentences={sentences} enabled={false} />);
    expect(screen.queryByText(/Tradução por frase/)).toBeNull();
    cleanup();
  });

  it("sem dados para a questão → estado vazio honesto", () => {
    render(<PlusPhraseCard type="tipo_sem_dados" qid="q_x" sentences={sentences} enabled />);
    expect(screen.getByText(/Tradução de frase não disponível para esta questão/)).toBeTruthy();
    cleanup();
  });

  it("com dados do banco: frase abre tradução por tap e fecha por novo tap", async () => {
    // usa um qid real do banco de frases (qualquer tipo com cobertura)
    const dir = resolve(__dirname, "../data/plus/phrases");
    const files = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    const f = files[0] as string;
    const type = f.replace(/\.json$/, "");
    const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const qid = Object.keys(data)[0] as string;
    const units = data[qid].t as Array<{ l: string; c?: string } | null>;
    // extrai só as posições traduzidas e reconstitui lista de frases
    const translated = units.map((u, i) => ({ u, i })).filter((x) => x.u !== null);
    expect(translated.length).toBeGreaterThan(0);
    const sample = translated.slice(0, 2).map((x) => `Frase teste ${x.i}.`);

    render(<PlusPhraseCard type={type} qid={qid} sentences={sample} enabled />);
    // dados carregam async (import.meta.glob): aguarda os botões das frases
    const buttons = await screen.findAllByRole("button");
    expect(buttons.length).toBe(sample.length);

    // abre a primeira: mostra tradução literal do banco na posição certa
    await act(async () => {
      fireEvent.click(buttons[0]!);
    });
    const first = translated[0]!.u!;
    expect(screen.getByText(first.l)).toBeTruthy();
    // fecha
    await act(async () => {
      fireEvent.click(buttons[0]!);
    });
    expect(screen.queryByText(first.l)).toBeNull();
    cleanup();
  });

  it("lookupPhrase alinha por posição", () => {
    const data = {
      q1: { t: [{ l: "um" }, null, { l: "três" }] },
    } as unknown as PhraseData;
    expect(lookupPhrase(data, "q1", 0)?.l).toBe("um");
    expect(lookupPhrase(data, "q1", 1)).toBeNull();
    expect(lookupPhrase(data, "q1", 2)?.l).toBe("três");
    expect(lookupPhrase(data, "q2", 0)).toBeNull();
  });
});

describe("Projeto 7 — independência do áudio do pack", () => {
  const sentences = splitSentences("The city grew fast. It never stopped.");

  beforeEach(() => {
    stubSpeech();
  });

  afterEach(() => {
    cleanup();
  });

  it("só áudio: PlusPhraseCard lista frases com 🔊 e SEM card de tradução", () => {
    render(
      <PlusPhraseCard
        type="tipo_sem_dados"
        qid="q_x"
        sentences={sentences}
        enabled={false}
        audioEnabled
      />,
    );
    expect(screen.getByText("Pronúncia por frase · Studie Plus")).toBeTruthy();
    expect(screen.queryByText("Tradução por frase · Studie Plus")).toBeNull();
    // um 🔊 por frase
    for (let i = 0; i < sentences.length; i++) {
      expect(
        screen.getByRole("button", { name: `Ouvir pronúncia da frase ${i + 1}` }),
      ).toBeTruthy();
    }
  });

  it("só áudio: o 🔊 fala o texto ORIGINAL em inglês (nunca pt-BR)", async () => {
    render(
      <PlusPhraseCard
        type="tipo_sem_dados"
        qid="q_x"
        sentences={sentences}
        enabled={false}
        audioEnabled
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ouvir pronúncia da frase 1" }));
    });
    expect(spoken.length).toBe(1);
    expect(spoken[0]!.text).toBe(sentences[0]!);
    expect(spoken[0]!.lang.toLowerCase().startsWith("pt")).toBe(false);
  });

  it("tradução + áudio: expansão mostra SÓ texto e o 🔊 fica fora da expansão", async () => {
    const dir = resolve(__dirname, "../data/plus/phrases");
    const files = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
    const f = files[0] as string;
    const type = f.replace(/\.json$/, "");
    const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const qid = Object.keys(data)[0] as string;
    const units = data[qid].t as Array<{ l: string; c?: string } | null>;
    const translated = units.map((u, i) => ({ u, i })).filter((x) => x.u !== null);
    const sample = translated.slice(0, 2).map((x) => `Frase teste ${x.i}.`);

    render(<PlusPhraseCard type={type} qid={qid} sentences={sample} enabled audioEnabled />);
    const speakButtons = await screen.findAllByRole("button", {
      name: /Ouvir pronúncia da frase/,
    });
    expect(speakButtons.length).toBe(sample.length);

    // abre a tradução: literal visível e NENHUM botão de fala dentro da expansão
    const toggles = await screen.findAllByRole("button", { name: /Frase teste/ });
    await act(async () => {
      fireEvent.click(toggles[0]!);
    });
    const expanded = screen.getByText(translated[0]!.u!.l);
    // o botão de fala não pode estar dentro do bloco de tradução
    const speakable = screen
      .getAllByRole("button", { name: /Ouvir pronúncia da frase/ })
      .every((b) => !b.contains(expanded) && !expanded.contains(b));
    expect(speakable).toBe(true);
  });

  it("só tradução: sem nenhum botão de fala no card (tradução é só texto)", async () => {
    render(<PlusPhraseCard type="tipo_sem_dados" qid="q_x" sentences={sentences} enabled />);
    await act(async () => {}); // descarrega effects (carga de frases) sem update fora do act
    expect(screen.getByText(/Tradução por frase/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ouvir pronúncia/ })).toBeNull();
  });

  it("só áudio: PlusWordText abre balão de pronúncia e a palavra fala em inglês", async () => {
    render(<PlusWordText text="The city grew fast." enabled={false} audioEnabled />);
    const targets = await screen.findAllByRole("button", { name: /Ouvir pronúncia de / });
    expect(targets.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(targets[0]!);
    });
    expect(screen.getByRole("dialog", { name: "Pronúncia da palavra" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ouvir pronúncia da palavra" }));
    });
    expect(spoken.length).toBe(1);
    expect(spoken[0]!.text).toBe("The");
    expect(spoken[0]!.lang.toLowerCase().startsWith("pt")).toBe(false);
    expect(screen.queryByText(/Tradução literal/i)).toBeNull();
  });

  it("tradução + áudio: o balão tem tradução (texto) E 🔊 da palavra em inglês", async () => {
    render(<PlusWordText text="The city grew fast." enabled audioEnabled />);
    const targets = await screen.findAllByRole("button", { name: /Traduzir e ouvir / });
    await act(async () => {
      fireEvent.click(targets[0]!);
    });
    expect(screen.getByRole("dialog", { name: "Tradução da palavra" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ouvir pronúncia da palavra" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ouvir pronúncia da palavra" }));
    });
    expect(spoken.length).toBe(1);
    expect(spoken[0]!.text).toBe("The");
  });

  it("REGRA: nenhum componente do pack fala pt-BR ou 'ouvir tradução' (varredura de fonte)", () => {
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const roots = [resolve(__dirname, "../components/plus"), resolve(__dirname, "../lib/plus")];
    for (const root of roots) {
      for (const f of readdirSync(root)) {
        if (!/\.(tsx|ts)$/.test(f)) continue;
        const src = stripComments(readFileSync(join(root, f), "utf8"));
        expect(src.includes("pt-BR"), `${f} contém pt-BR`).toBe(false);
        expect(src.includes("ouvir tradução"), `${f} contém 'ouvir tradução'`).toBe(false);
      }
    }
  });
});

describe("Pipeline de dados de frases — integridade (8 tipos)", () => {
  const dir = resolve(__dirname, "../data/plus/phrases");
  const bank = (t: string) => {
    const p = resolve(__dirname, `../data/pte/${t}.json`);
    try {
      const d = JSON.parse(readFileSync(p, "utf8"));
      return (Array.isArray(d) ? d : (d.questions ?? [])) as Array<{ id: string }>;
    } catch {
      return [];
    }
  };

  it("todo arquivo phrases/{type}.json referencia qids reais do banco e t bem-formado", () => {
    const files = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
    const checked = new Set<string>();
    for (const f of files) {
      const type = f.replace(/\.json$/, "");
      const ids = new Set(bank(type).map((q) => q.id));
      const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
      for (const [qid, entry] of Object.entries(data as Record<string, { t: unknown[] }>)) {
        expect(ids.has(qid), `${type}: qid ${qid} não existe no banco`).toBe(true);
        expect(Array.isArray(entry.t), `${type}/${qid}: t deve ser array`).toBe(true);
        for (const u of entry.t) {
          if (u === null) continue;
          const e = u as { l?: unknown; c?: unknown };
          expect(typeof e.l === "string" && e.l.length >= 1 && e.l.length <= 400).toBe(true);
          if (e.c != null) expect(typeof e.c === "string" && e.c.length <= 200).toBe(true);
        }
        checked.add(`${type}|${qid}`);
      }
    }
    expect(checked.size).toBeGreaterThan(0);
  });

  it("cobertura residual: swt e write_essay têm dados de tradução", () => {
    for (const type of ["swt", "write_essay"]) {
      const p = join(dir, `${type}.json`);
      const raw = readFileSync(p, "utf8");
      const data = JSON.parse(raw);
      const withData = Object.values(data as Record<string, { t: unknown[] }>).filter((e) =>
        e.t.some((t) => t !== null),
      );
      expect(withData.length, `${type}: nenhuma questão traduzida`).toBeGreaterThan(0);
    }
  });
});
