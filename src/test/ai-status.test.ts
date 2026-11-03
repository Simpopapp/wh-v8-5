import { describe, expect, it } from "vitest";

import {
  AI_COOLDOWN_MS,
  aiUsable,
  enterCooldown,
  inCooldown,
  isPaused,
  loadAiStatus,
  mechanismLabel,
  pauseForCredits,
  resumeAi,
  saveAiStatus,
} from "@/lib/plus/aiStatus";

describe("aiStatus", () => {
  it("cooldown expira após 60 s", () => {
    const state = enterCooldown({ cooldownUntil: 0, pausedAt: null }, 1000);
    expect(inCooldown(state, 1000)).toBe(true);
    expect(state.cooldownUntil).toBe(1000 + AI_COOLDOWN_MS);
    expect(inCooldown(state, 1000 + AI_COOLDOWN_MS + 1)).toBe(false);
  });

  it("pausa por créditos persiste e só re-arma manualmente", () => {
    const state = pauseForCredits({ cooldownUntil: 0, pausedAt: null }, 42);
    expect(isPaused(state)).toBe(true);
    expect(isPaused({ ...state, pausedAt: null })).toBe(false);
    expect(resumeAi(state)).toEqual({ cooldownUntil: 0, pausedAt: null });
  });

  it("aiUsable exige toggle on + online + sem pausa + sem cooldown", () => {
    const now = Date.now();
    const clean = { cooldownUntil: 0, pausedAt: null };
    expect(aiUsable(true, true, clean)).toBe(true);
    expect(aiUsable(false, true, clean)).toBe(false);
    expect(aiUsable(true, false, clean)).toBe(false);
    expect(aiUsable(true, true, pauseForCredits(clean, now))).toBe(false);
    expect(aiUsable(true, true, enterCooldown(clean, now))).toBe(false);
  });

  it("rótulo do mecanismo cobre os cinco estados", () => {
    const now = Date.now();
    const clean = { cooldownUntil: 0, pausedAt: null };
    expect(mechanismLabel(true, true, clean)).toBe("IA online");
    expect(mechanismLabel(false, true, clean)).toContain("IA desligada");
    expect(mechanismLabel(true, false, clean)).toContain("sem internet");
    expect(mechanismLabel(true, true, pauseForCredits(clean, now))).toContain("créditos");
    expect(mechanismLabel(true, true, enterCooldown(clean, now))).toContain("recuperando");
  });

  it("persistência tolera JSON inválido", () => {
    expect(loadAiStatus({ getItem: () => "{quebrado}" })).toEqual({
      cooldownUntil: 0,
      pausedAt: null,
    });
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => saveAiStatus({ cooldownUntil: 0, pausedAt: null }, storage)).not.toThrow();
  });
});
