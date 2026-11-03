import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLUS,
  DEFAULT_SETTINGS,
  migrateLegacyState,
  normalizePlusSettings,
} from "@/lib/storage";
import { PLUS_TOGGLES, plusEnabled } from "@/lib/plus/settings";

describe("Studie Plus — settings", () => {
  it("defaults do pack: traduções/áudio desligados; IA e captura de vocabulário ligados", () => {
    expect(DEFAULT_PLUS).toEqual({
      wordTranslation: false,
      phraseTranslation: false,
      aiTranslation: true,
      plusAudio: false,
      vocabCapture: true,
    });
    expect(DEFAULT_SETTINGS.plus).toEqual(DEFAULT_PLUS);
  });

  it("normalizePlusSettings aceita só boolean true (vocabCapture/aiTranslation: só false explícito desliga)", () => {
    expect(normalizePlusSettings(undefined)).toEqual(DEFAULT_PLUS);
    expect(normalizePlusSettings(null)).toEqual(DEFAULT_PLUS);
    expect(normalizePlusSettings({})).toEqual(DEFAULT_PLUS);
    expect(
      normalizePlusSettings({
        wordTranslation: true,
        phraseTranslation: "sim",
        plusAudio: 1,
      }),
    ).toEqual({
      wordTranslation: true,
      phraseTranslation: false,
      aiTranslation: true,
      plusAudio: false,
      vocabCapture: true,
    });
    expect(normalizePlusSettings({ wordTranslation: true, vocabCapture: false })).toEqual({
      wordTranslation: true,
      phraseTranslation: false,
      aiTranslation: true,
      plusAudio: false,
      vocabCapture: false,
    });
    expect(normalizePlusSettings({ aiTranslation: false })).toEqual({
      wordTranslation: false,
      phraseTranslation: false,
      aiTranslation: false,
      plusAudio: false,
      vocabCapture: true,
    });
  });

  it("migração v4 → v7 ganha pack desligado (IA e captura ligados) sem perder settings v4", () => {
    const v4 = migrateLegacyState({
      version: 4,
      attempts: [],
      bookmarks: [],
      settings: { dailyGoal: 12, targetScore: 79, examDate: "2026-12-01" },
    });
    expect(v4.version).toBe(7);
    expect(v4.settings.dailyGoal).toBe(12);
    expect(v4.settings.targetScore).toBe(79);
    expect(v4.settings.examDate).toBe("2026-12-01");
    expect(v4.settings.plus).toEqual(DEFAULT_PLUS);
  });

  it("migração v5 preserva os flags do pack; campos ausentes viram ligados (projetos 10/11)", () => {
    const v5 = migrateLegacyState({
      version: 5,
      attempts: [],
      bookmarks: [],
      settings: { plus: { wordTranslation: true, phraseTranslation: false, plusAudio: true } },
    });
    expect(v5.version).toBe(7);
    expect(v5.settings.plus).toEqual({
      wordTranslation: true,
      phraseTranslation: false,
      aiTranslation: true,
      plusAudio: true,
      vocabCapture: true,
    });
  });

  it("plusEnabled reflete qualquer flag ativo", () => {
    const base = { ...DEFAULT_SETTINGS };
    expect(plusEnabled(base)).toBe(false);
    expect(plusEnabled({ ...base, plus: { ...DEFAULT_PLUS, phraseTranslation: true } })).toBe(true);
    expect(plusEnabled({ ...base, plus: { ...DEFAULT_PLUS, plusAudio: true } })).toBe(true);
    // vocabCapture e aiTranslation sozinhos NÃO ativam o carregamento de dados do pack
    expect(plusEnabled({ ...base, plus: { ...DEFAULT_PLUS, vocabCapture: true } })).toBe(false);
    expect(plusEnabled({ ...base, plus: { ...DEFAULT_PLUS, aiTranslation: true } })).toBe(false);
  });

  it("catálogo de toggles do pack cobre exatamente os 5 recursos", () => {
    expect(PLUS_TOGGLES.map((t) => t.key)).toEqual([
      "wordTranslation",
      "phraseTranslation",
      "aiTranslation",
      "plusAudio",
      "vocabCapture",
    ]);
  });
});
