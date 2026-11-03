import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  THEME_KEY,
  applyTheme,
  getThemeMode,
  resolvedDark,
  setThemeMode,
  watchSystemTheme,
} from "@/lib/theme";

function mockMatchMedia(dark: boolean) {
  const listeners = new Set<() => void>();
  const mq = {
    matches: dark,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal("matchMedia", (query: string) => {
    if (query.includes("prefers-color-scheme")) return mq;
    return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
  });
  return {
    flip: (next: boolean) => {
      (mq as { matches: boolean }).matches = next;
      for (const fn of listeners) fn();
    },
    cleanup: () => vi.unstubAllGlobals(),
  };
}

describe("proj13 fase 4 — tema Claro/Escuro/Sistema (D11)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("getThemeMode sem preferência (ou inválida) cai em 'system'", () => {
    expect(getThemeMode()).toBe("system");
    window.localStorage.setItem(THEME_KEY, "roxo");
    expect(getThemeMode()).toBe("system");
  });

  it("setThemeMode persiste a preferência e aplica a classe .dark", () => {
    expect(setThemeMode("dark")).toBe("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(getThemeMode()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    setThemeMode("light");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("modo 'system' resolve pelo prefers-color-scheme; light/dark decidem sozinhos", () => {
    const media = mockMatchMedia(true);
    try {
      expect(resolvedDark("system")).toBe(true);
      expect(resolvedDark("light")).toBe(false);
      expect(resolvedDark("dark")).toBe(true);
    } finally {
      media.cleanup();
    }
  });

  it("applyTheme('system') reage à mudança do sistema; preferência explícita não é sobrescrita", () => {
    const media = mockMatchMedia(false);
    try {
      applyTheme("system");
      expect(document.documentElement.classList.contains("dark")).toBe(false);

      let watched = 0;
      const stop = watchSystemTheme("system", () => {
        watched += 1;
      });
      applyTheme("system");
      media.flip(true);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(watched).toBe(1);

      // preferência explícita "light": mudança do sistema não reabilita escuro
      window.localStorage.setItem(THEME_KEY, "light");
      media.flip(false);
      applyTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      stop();
    } finally {
      media.cleanup();
    }
  });

  it("setThemeMode sob storage bloqueado ainda aplica nesta sessão", () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    try {
      setThemeMode("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    } finally {
      Storage.prototype.setItem = original;
      vi.restoreAllMocks();
    }
  });
});
