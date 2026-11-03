// Projeto 13, Fase 0 — fundação de integridade: merge idempotente (D2/D3/D4),
// undo honesto (§0.2), foco contido no TranslationSheet (D10), atalhos que
// respeitam modal e cache IA servindo offline (D7).
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { TranslationSheet } from "@/components/plus/TranslationSheet";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { shouldSkipShortcut } from "@/lib/shortcutGuard";
import { applyBackup, mergeStates, previewMergeStates, undoBackup } from "@/lib/backup";
import { UNDO_KEY, emptyState, exportBackup, getStateSnapshot, replaceState } from "@/lib/storage";
import { aiCacheStore, wordCacheKey } from "@/lib/plus/aiCache";
import type { Attempt, QuestionSnapshot } from "@/lib/storage";

const mockTranslateWord = vi.hoisted(() => vi.fn());
vi.mock("@/lib/plus/ai-translate.functions", () => ({
  translateAiWord: mockTranslateWord,
  translateAiPhrase: vi.fn(),
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

function attempt(partial: Partial<Attempt> & { qid: string; ts: number }): Attempt {
  return {
    taskType: "read_aloud",
    mode: "speech",
    contentScore: null,
    score: null,
    wpm: null,
    durationMs: 0,
    ...partial,
  };
}

function snapshot(partial: Partial<QuestionSnapshot>): QuestionSnapshot {
  return {
    attempts: 1,
    bestScore: null,
    bestWpm: null,
    lastScore: null,
    lastAttemptAt: 0,
    strongAttempts: 0,
    dueStrongAttempts: 0,
    prevStrong: false,
    lastAttemptDue: false,
    box: 0,
    dueAt: 0,
    ...partial,
  };
}

/** Estado local: 1 tentativa (qid A) + agregado do dia. */
function stateLocal(): ReturnType<typeof emptyState> {
  const s = emptyState();
  s.attempts = [attempt({ qid: "qA", ts: 1_700_000_000_000, score: 70 })];
  s.daily = { "2023-11-14": { attempts: 1, scored: 1, sum: 70 } };
  s.questions = {
    qA: snapshot({ attempts: 1, lastScore: 70, lastAttemptAt: 1_700_000_000_000 }),
  };
  return s;
}

/** Estado do backup: 2 tentativas (A repetida + B) e o mesmo dia. */
function stateBackup(): ReturnType<typeof emptyState> {
  const s = emptyState();
  s.attempts = [
    attempt({ qid: "qA", ts: 1_700_000_000_000, score: 70 }),
    attempt({ qid: "qB", ts: 1_700_000_400_000, score: 90 }),
  ];
  s.daily = { "2023-11-14": { attempts: 2, scored: 2, sum: 160 } };
  s.questions = {
    qA: snapshot({ attempts: 1, lastScore: 70, lastAttemptAt: 1_700_000_000_000 }),
    qB: snapshot({ attempts: 1, lastScore: 90, lastAttemptAt: 1_700_000_400_000 }),
  };
  return s;
}

beforeEach(() => {
  window.localStorage.clear();
  replaceState(emptyState());
  mockTranslateWord.mockReset();
  aiCacheStore.reset();
});

afterEach(() => {
  cleanup();
});

describe("Merge idempotente (projeto 13, D2/D4)", () => {
  it("mergeStates(A, A) não infla tentativas, agregados, snapshots nem sessões", () => {
    const a = stateBackup();
    const merged = mergeStates(a, a);
    expect(merged.attempts).toHaveLength(a.attempts.length);
    expect(merged.daily).toEqual(a.daily);
    expect(merged.questions["qA"]).toEqual(a.questions["qA"]);
    expect(merged.questions["qB"]).toEqual(a.questions["qB"]);
    expect(merged.sessions).toHaveLength(a.sessions.length);
    expect(merged.bookmarks).toEqual(a.bookmarks);
  });

  it("interseção parcial: união deduplicada e snapshot reconciliado por evidência", () => {
    const cur = stateBackup();
    // O backup traz uma tentativa nova (C) e um lapso mais recente em qA.
    const inc = stateBackup();
    inc.attempts = [...inc.attempts, attempt({ qid: "qC", ts: 1_700_001_000_000, score: 80 })];
    inc.questions["qA"] = snapshot({
      attempts: 2,
      lastScore: 40,
      lastAttemptAt: 1_700_002_000_000,
      box: 1,
      dueAt: 1_800_000_000_000,
    });
    const merged = mergeStates(cur, inc);
    // qA compartilha tentativa → contadores do lado mais recente (evidência).
    expect(merged.questions["qA"]?.attempts).toBe(2);
    expect(merged.questions["qA"]?.lastScore).toBe(40);
    // Lapso recente vence promoção antiga (D4).
    expect(merged.questions["qA"]?.box).toBe(1);
    // Tentativas: A + B + A(dup) + C → dedupe por identidade = 3.
    expect(merged.attempts).toHaveLength(3);
  });

  it("previewMergeStates(A, A) reporta contagens estáveis e ajustes locais", () => {
    const a = stateBackup();
    const preview = previewMergeStates(a, a);
    expect(preview.attempts).toEqual({ before: 2, after: 2 });
    expect(preview.questions).toEqual({ before: 2, after: 2 });
    expect(preview.settingsPolicy).toBe("locais");
  });
});

describe("Import/undo honesto (projeto 13, §0.2)", () => {
  it("importar o MESMO backup (merge) duas vezes não infla o progresso", () => {
    replaceState(stateBackup());
    const json = exportBackup();
    replaceState(stateLocal());
    const first = applyBackup(json, "merge");
    expect(first).toMatchObject({ ok: true, undoSaved: true });
    const after1 = getStateSnapshot();
    expect(after1.attempts).toHaveLength(2);
    const second = applyBackup(json, "merge");
    expect(second).toMatchObject({ ok: true });
    const after2 = getStateSnapshot();
    expect(after2.attempts).toHaveLength(after1.attempts.length);
    expect(after2.daily).toEqual(after1.daily);
    expect(after2.questions["qB"]?.attempts).toBe(after1.questions["qB"]?.attempts);
  });

  it("sem espaço para o undo: import PARA e só segue com confirmação explícita", () => {
    replaceState(stateLocal());
    const json = exportBackup();
    const proto = Storage.prototype as unknown as {
      setItem: (k: string, v: string) => void;
    };
    const original = proto.setItem;
    proto.setItem = function (k, v) {
      if (k === UNDO_KEY) throw new Error("quota");
      return original.call(this, k, v);
    };
    try {
      const before = getStateSnapshot();
      const refused = applyBackup(json, "replace");
      expect(refused).toMatchObject({ ok: false, error: "sem-undo", undoSaved: false });
      // Estado intacto — a operação destrutiva não seguiu em silêncio.
      expect(getStateSnapshot().attempts).toEqual(before.attempts);

      const forced = applyBackup(json, "replace", { allowWithoutUndo: true });
      expect(forced).toMatchObject({ ok: true, undoSaved: false });
    } finally {
      proto.setItem = original;
    }
  });

  it("desfazer restaura o estado anterior à importação", () => {
    replaceState(stateBackup());
    const json = exportBackup();
    replaceState(stateLocal());
    const antes = getStateSnapshot();
    expect(antes.attempts).toHaveLength(1);
    expect(applyBackup(json, "replace")).toMatchObject({ ok: true });
    expect(getStateSnapshot().attempts).toHaveLength(2);
    expect(undoBackup()).toBe(true);
    expect(getStateSnapshot().attempts).toEqual(antes.attempts);
  });
});

describe("Contrato de interação (projeto 13, D10)", () => {
  it("atalhos globais: modal aberto ou evento já tratado congela a navegação", () => {
    const base = { defaultPrevented: false, target: document.body } as unknown as KeyboardEvent;
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    expect(shouldSkipShortcut(base, document)).toBe(true);

    document.body.innerHTML = "";
    expect(shouldSkipShortcut(base, document)).toBe(false);
    expect(
      shouldSkipShortcut({ ...base, defaultPrevented: true } as unknown as KeyboardEvent, document),
    ).toBe(true);
    const inField = {
      defaultPrevented: false,
      target: document.createElement("input"),
    } as unknown as KeyboardEvent;
    expect(shouldSkipShortcut(inField, document)).toBe(true);
  });

  it("TranslationSheet: Tab fica dentro do painel e fechar devolve o foco ao gatilho", async () => {
    const onClose = vi.fn();
    const sheet = (open: boolean) => (
      <>
        <button>Abrir tradução</button>
        <TranslationSheet
          open={open}
          onClose={onClose}
          title="scarce"
          ariaLabel="Tradução da palavra"
        >
          <p>conteúdo</p>
        </TranslationSheet>
      </>
    );
    const { rerender } = render(sheet(false));
    screen.getByText("Abrir tradução").focus();
    rerender(sheet(true));

    const dialog = screen.getByRole("dialog", { name: "Tradução da palavra" });
    await waitFor(() => expect(document.activeElement).toBe(dialog));

    // Tab a partir do painel → cai no primeiro focável DENTRO do sheet.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    // Shift+Tab a partir dele → continua dentro (trap cíclico).
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Esc pede o fecho (o sheet é controlado: o dono do estado decide).
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(sheet(false));
    expect(screen.queryByRole("dialog", { name: "Tradução da palavra" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByText("Abrir tradução"));
  });
});

describe("Cache IA antes da rede (projeto 13, D7)", () => {
  it("offline: tradução já paga vem do cache com chip honesto — IA não é chamada", async () => {
    aiCacheStore.putWord(wordCacheKey("rigorous", TEXT), WORD_RESULT);
    render(<PlusWordText text={TEXT} enabled aiEnabled source={SOURCE} />);
    window.dispatchEvent(new Event("offline"));

    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    const dialog = await screen.findByRole("dialog", { name: "Tradução da palavra" });
    expect(await screen.findByText("rigoroso, meticuloso")).toBeTruthy();
    expect(dialog.textContent).toContain("Cache IA");
    expect(mockTranslateWord).not.toHaveBeenCalled();
  });
});
