import { describe, expect, it } from "vitest";

import { countdownLabel, daysUntil, estimateTargetLabel, targetVerdict } from "@/lib/pte/goal";
import { DEFAULT_SETTINGS, isValidExamDate, migrateLegacyState } from "@/lib/storage";

// Fixtures usam meio-dia UTC para não depender do fuso do ambiente.
const now = Date.UTC(2026, 9, 10, 12, 0, 0); // 2026-10-10T12:00Z

describe("isValidExamDate", () => {
  it("aceita YYYY-MM-DD reais", () => {
    expect(isValidExamDate("2026-12-01")).toBe(true);
    expect(isValidExamDate("2024-02-29")).toBe(true); // bissexto
  });

  it("rejeita formatos e datas inexistentes", () => {
    expect(isValidExamDate(null)).toBe(false);
    expect(isValidExamDate(undefined)).toBe(false);
    expect(isValidExamDate("")).toBe(false);
    expect(isValidExamDate("2026-13-01")).toBe(false);
    expect(isValidExamDate("2025-02-29")).toBe(false); // não bissexto
    expect(isValidExamDate("01-12-2026")).toBe(false);
    expect(isValidExamDate("2026-12-01T10:00:00Z")).toBe(false);
  });
});

describe("daysUntil", () => {
  it("conta dias inteiros até a prova", () => {
    expect(daysUntil("2026-10-10", now)).toBe(0); // hoje
    expect(daysUntil("2026-10-11", now)).toBe(1);
    expect(daysUntil("2027-10-10", now)).toBe(365);
  });

  it("retorna null sem data, inválida ou no passado", () => {
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil("2026-13-40", now)).toBeNull();
    expect(daysUntil("2026-10-09", now)).toBeNull(); // ontem
    expect(daysUntil("2020-01-01", now)).toBeNull();
  });
});

describe("targetVerdict (estimativa 10–90 vs. alvo 10–90 — mesma escala)", () => {
  it("sem dados → none", () => {
    expect(targetVerdict(null, 65)).toEqual({ label: "Sem dados suficientes", tone: "none" });
  });

  it("classifica abaixo / quase / no alvo", () => {
    expect(targetVerdict(40, 65).tone).toBe("below");
    expect(targetVerdict(50, 65).tone).toBe("near");
    expect(targetVerdict(79, 65).tone).toBe("on");
    expect(targetVerdict(65, 65).tone).toBe("on"); // borda
  });
});

describe("estimateTargetLabel", () => {
  it("rótulo na mesma escala, sem % junto", () => {
    expect(estimateTargetLabel(62, 65)).toBe("Estimativa de treino: 62 · Alvo: 65");
    expect(estimateTargetLabel(null, 65)).toBe("Sem estimativa de treino ainda · Alvo: 65");
  });
});

describe("countdownLabel", () => {
  it("rotula hoje, amanhã e futuro", () => {
    expect(countdownLabel(0)).toBe("A prova é hoje!");
    expect(countdownLabel(1)).toBe("Falta 1 dia para a prova");
    expect(countdownLabel(30)).toBe("Faltam 30 dias para a prova");
    expect(countdownLabel(null)).toBeNull();
  });
});

describe("Settings v4 (migração)", () => {
  it("migra v3 para v4 com defaults de prova", () => {
    const v3 = {
      version: 3,
      attempts: [],
      bookmarks: [],
      notes: {},
      sessions: [],
      draft: null,
      settings: { prepSeconds: 40, dailyGoal: 10, modelRate: 1, accent: "en-AU" },
    };
    const migrated = migrateLegacyState(v3);
    expect(migrated.version).toBe(7);
    expect(migrated.settings.examDate).toBeNull();
    expect(migrated.settings.targetScore).toBe(DEFAULT_SETTINGS.targetScore);
  });

  it("preserva examDate/targetScore válidos do v4 e descarta inválidos", () => {
    const v4 = {
      version: 4,
      attempts: [],
      bookmarks: [],
      notes: {},
      sessions: [],
      draft: null,
      settings: { examDate: "2026-12-15", targetScore: 79 },
    };
    const migrated = migrateLegacyState(v4);
    expect(migrated.settings.examDate).toBe("2026-12-15");
    expect(migrated.settings.targetScore).toBe(79);

    const bad = migrateLegacyState({
      ...v4,
      settings: { examDate: "não-é-data", targetScore: 500 },
    });
    expect(bad.settings.examDate).toBeNull();
    expect(bad.settings.targetScore).toBe(DEFAULT_SETTINGS.targetScore);

    const clamped = migrateLegacyState({ ...v4, settings: { targetScore: 42.6 } });
    expect(clamped.settings.targetScore).toBe(43);
  });
});
