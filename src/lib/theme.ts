/**
 * Tema Claro/Escuro/Sistema (projeto 13, D11).
 *
 * A preferência vive em localStorage (chave dedicada) — NÃO dentro do AppState:
 * precisa ser lida por um script inline antes da primeira pintura (sem flash).
 * `applyTheme` idempotente: o script pré-pintura já aplica a classe; a lib só
 * sincroniza (troca de opção, mudança do SO) e escreve colorScheme.
 */

export type ThemeMode = "light" | "dark" | "system";

export const THEME_KEY = "ptehub:theme";
export const DEFAULT_THEME: ThemeMode = "system";

export const THEME_OPTIONS: { value: ThemeMode; label: string; hint: string }[] = [
  { value: "light", label: "Claro", hint: "Sempre claro" },
  { value: "dark", label: "Escuro", hint: "Sempre escuro" },
  { value: "system", label: "Sistema", hint: "Segue o aparelho" },
];

/** Modo salvo; "system" quando ausente/inválido/sem window (SSR). */
export function getThemeMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* storage bloqueado → padrão */
  }
  return DEFAULT_THEME;
}

/** Escuro resolvido: modo escuro, ou sistema com prefers-color-scheme escuro. */
export function resolvedDark(mode: ThemeMode): boolean {
  if (typeof window === "undefined") return false;
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Aplica o modo no <html>: classe .dark + colorScheme. Idempotente. */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const dark = resolvedDark(mode);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Persiste e aplica. Retorna o modo normalizado. */
export function setThemeMode(mode: ThemeMode): ThemeMode {
  const next: ThemeMode = mode;
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    /* sem persistência: aplica só nesta sessão */
  }
  applyTheme(next);
  return next;
}

/**
 * Observa mudanças do sistema enquanto o modo é "system".
 * Retorna a função de limpeza (idempotente no unmount).
 */
export function watchSystemTheme(mode: ThemeMode, onChange?: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => {
    if (getThemeMode() === "system") {
      applyTheme("system");
      onChange?.();
    }
  };
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}
