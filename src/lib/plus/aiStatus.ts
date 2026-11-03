/**
 * Estado do mecanismo de tradução no cliente (PRD projeto 11, §2.6 / D10):
 * online/offline, cooldown pós-falha transitória (60 s) e pausa por créditos
 * esgotados (402, persistida e honesta — nunca retry cego).
 */
export const AI_STATUS_KEY = "pte-plus-ai-status";
export const AI_COOLDOWN_MS = 60_000;

export interface AiStatusState {
  /** Timestamp (ms) até o qual a IA está em cooldown por falha transitória. */
  cooldownUntil: number;
  /** Timestamp (ms) da pausa por 402 (créditos). Só o usuário re-arma. */
  pausedAt: number | null;
}

export const emptyAiStatus = (): AiStatusState => ({ cooldownUntil: 0, pausedAt: null });

export function loadAiStatus(storage: Pick<Storage, "getItem"> = localStorage): AiStatusState {
  try {
    const raw = storage.getItem(AI_STATUS_KEY);
    if (!raw) return emptyAiStatus();
    const parsed = JSON.parse(raw) as AiStatusState;
    return {
      cooldownUntil: typeof parsed.cooldownUntil === "number" ? parsed.cooldownUntil : 0,
      pausedAt: typeof parsed.pausedAt === "number" ? parsed.pausedAt : null,
    };
  } catch {
    return emptyAiStatus();
  }
}

export function saveAiStatus(
  state: AiStatusState,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(AI_STATUS_KEY, JSON.stringify(state));
  } catch {
    // status é descartável
  }
}

export function enterCooldown(state: AiStatusState, now: number = Date.now()): AiStatusState {
  return { ...state, cooldownUntil: now + AI_COOLDOWN_MS };
}

export function pauseForCredits(state: AiStatusState, now: number = Date.now()): AiStatusState {
  return { ...state, pausedAt: now };
}

export function resumeAi(state: AiStatusState): AiStatusState {
  return { cooldownUntil: 0, pausedAt: null };
}

export function inCooldown(state: AiStatusState, now: number = Date.now()): boolean {
  return state.cooldownUntil > now;
}

export function isPaused(state: AiStatusState): boolean {
  return state.pausedAt !== null;
}

/** Decisão central: a IA pode responder neste momento? */
export function aiUsable(
  settingsAiEnabled: boolean,
  online: boolean,
  status: AiStatusState,
): boolean {
  return settingsAiEnabled && online && !isPaused(status) && !inCooldown(status);
}

/** Rótulo do mecanismo para a linha de status em Ajustes. */
export function mechanismLabel(
  settingsAiEnabled: boolean,
  online: boolean,
  status: AiStatusState,
): string {
  if (!settingsAiEnabled) return "Dicionário do pack (IA desligada)";
  if (!online) return "Dicionário do pack (sem internet)";
  if (isPaused(status)) return "Dicionário do pack (IA em pausa — créditos)";
  if (inCooldown(status)) return "Dicionário do pack (IA recuperando)";
  return "IA online";
}

const AI_SESSION_KEY = "pte-plus-ai-session";

/**
 * Chave anônima de sessão para o rate limit do servidor (projeto 13, D9).
 * Não é identidade nem token: é um identificador opaco gerado no cliente,
 * que dá a cada navegador uma cota própria e evita que um único abuso
 * esgote a janela global.
 */
export function aiSessionId(): string {
  if (typeof window === "undefined") return "anon-fallback";
  try {
    let v = window.localStorage.getItem(AI_SESSION_KEY);
    if (!v || v.length < 8 || v.length > 64) {
      v = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(AI_SESSION_KEY, v);
    }
    return v;
  } catch {
    return "anon-fallback";
  }
}
