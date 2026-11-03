/**
 * Rate limit próprio das server functions de IA (projeto 13, D9).
 * Os handlers são públicos: CSRF não contém custo. Janela simples em
 * memória do Worker, por sessão anônima (chave gerada no cliente) e com
 * teto global — o pior caso de abuso é limitado por processo.
 *
 * Não é autenticação: é contenção de custo/abuso com chave não verificada.
 * O 429 mapeia para o cooldown existente do cliente (`aiStatus`).
 */

const WINDOW_MS = 5 * 60_000;
/** Máximo de traduções por chave de sessão dentro da janela. */
export const RATE_LIMIT_PER_KEY = 30;
/** Teto global por processo dentro da janela (contenção de abuso amplo). */
export const RATE_LIMIT_GLOBAL = 240;
/** Teto de chaves rastreadas (poda contra memória descontrolada). */
const MAX_KEYS = 1_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let globalBucket: Bucket = { count: 0, resetAt: 0 };

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

function windowLeft(resetAt: number, now: number): number {
  return Math.max(0, resetAt - now);
}

function takeGlobal(now: number): RateLimitResult {
  if (globalBucket.resetAt <= now) {
    globalBucket = { count: 0, resetAt: now + WINDOW_MS };
  }
  globalBucket.count += 1;
  return globalBucket.count > RATE_LIMIT_GLOBAL
    ? { ok: false, retryAfterMs: windowLeft(globalBucket.resetAt, now) }
    : { ok: true };
}

/**
 * Consome uma unidade da cota da chave (e do teto global).
 * Chave ausente/inválida cai no bucket anônimo compartilhado.
 */
export function checkRateLimit(
  sessionKey: string | undefined,
  now: number = Date.now(),
): RateLimitResult {
  const g = takeGlobal(now);
  if (!g.ok) return g;

  const key = sessionKey && sessionKey.length >= 8 && sessionKey.length <= 64 ? sessionKey : "anon";
  // Poda: janela expirada sai; teto absoluto protege memória do Worker.
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
    if (buckets.size > MAX_KEYS) {
      const first = buckets.keys().next();
      if (!first.done) buckets.delete(first.value);
    }
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  b.count += 1;
  if (b.count > RATE_LIMIT_PER_KEY) {
    return { ok: false, retryAfterMs: windowLeft(b.resetAt, now) };
  }
  return { ok: true };
}

/** Para testes: limpa todo o estado de rate limit. */
export function resetRateLimits(): void {
  buckets.clear();
  globalBucket = { count: 0, resetAt: 0 };
}
