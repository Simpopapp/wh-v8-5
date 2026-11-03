import { useSyncExternalStore } from "react";

import { TYPE_META, allMeta, getMeta, type QuestionMeta, type TaskType } from "@/lib/pte";
import { EXAM_SECONDS } from "@/lib/pte/exam";
import {
  addSessionRecord,
  clearSessionDraft,
  getSessionDraft,
  getStateSnapshot,
  saveSessionDraft,
  type SessionKind,
  type SessionResult,
} from "@/lib/storage";
import type { QuestionStat } from "@/lib/storage";

export type { SessionResult } from "@/lib/storage";

export interface SessionState {
  active: boolean;
  size: number;
  queue: string[];
  index: number; // próxima questão a responder
  startedAt: number;
  results: SessionResult[];
  /** Questões puladas com motivo (reagendadas, sem score — §4.2). */
  skips: number;
  /** Contexto da sessão (histórico). */
  kind: SessionKind;
  label: string;
  /** true quando a sessão já foi arquivada no histórico (evita duplicar no endSession). */
  archived: boolean;
}

const IDLE: SessionState = {
  active: false,
  size: 0,
  queue: [],
  index: 0,
  startedAt: 0,
  results: [],
  skips: 0,
  kind: "srs",
  label: "Sessão",
  archived: false,
};

let state: SessionState = IDLE;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Questões de task types que já têm motor de prática. */
const readyMeta: QuestionMeta[] = allMeta.filter((m) => TYPE_META[m.taskType].ready);

/** Score abaixo do qual a última tentativa conta como "erro" (modo Revisar erros). */
export const ERROR_SCORE = 70;

/** Limiar de "erro" por task type (projeto 13, §4.2): quando um tipo tem limiar
 * próprio, ele vale IGUAL em "Revisar erros" e no modo misto — conceito único,
 * com rótulo explicando o critério ("última nota < N"). */
export const ERROR_THRESHOLD_BY_TYPE: Partial<Record<TaskType, number>> = {};

export function errorThresholdFor(type: TaskType): number {
  return ERROR_THRESHOLD_BY_TYPE[type] ?? ERROR_SCORE;
}

/** Última tentativa abaixo do limiar do tipo = "erro" (conceito único, §4.2). */
export function isErrorStat(s: QuestionStat | undefined, type: TaskType): boolean {
  return (s?.lastScore ?? 100) < errorThresholdFor(type);
}

/** Rand determinístico (LCG semeado) — usado pelo seletor de sessão: o preview
 * (duração exibida) e a fila real são gerados com o mesmo seed, então o que a
 * UI promete é o que a fila executa (projeto 13, §4.2). */
export function seededRand(seed = 1): Rand {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Duração estimada da fila (s) — soma dos tempos oficiais por tipo
 * (EXAM_SECONDS) das questões que estão DE FATO na fila. */
export function estimateSessionSeconds(ids: string[]): number {
  let total = 0;
  for (const id of ids) {
    const q = getMeta(id);
    if (q) total += EXAM_SECONDS[q.taskType];
  }
  return total;
}

/** Duração estimada em texto curto (pt-BR): "≈ 12 min". */
export function formatSessionDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `≈ ${minutes} min`;
}

type Rand = () => number;

function shuffle<T>(list: T[], rand: Rand): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Round-robin por task type, preservando a ordem interna de cada tipo (evita fila de um tipo só). */
export function interleaveByType<T extends { taskType: TaskType }>(list: T[]): T[] {
  const buckets = new Map<TaskType, T[]>();
  for (const item of list) {
    const b = buckets.get(item.taskType) ?? [];
    b.push(item);
    buckets.set(item.taskType, b);
  }
  const lanes = [...buckets.values()];
  const out: T[] = [];
  for (let i = 0; lanes.some((l) => i < l.length); i++) {
    for (const l of lanes) if (i < l.length) out.push(l[i]!);
  }
  return out;
}

export interface QueueOptions {
  /** "smart" (padrão): revisões vencidas + novas; "errors": só o que errou na última vez;
   *  "due": exclusivamente revisões vencidas (fila do dia), pior último score primeiro. */
  mode?: "smart" | "errors" | "due";
  /** Restringe a fila a estes task types. */
  taskTypes?: TaskType[];
  /** D4: só fontes verificadas (padrão das sessões vem dos Ajustes). */
  verifiedOnly?: boolean;
  now?: number;
  rand?: Rand;
}

/**
 * Pool de treino: quase-duplicatas saem sempre (C3 — não treinar duas vezes);
 * com `verifiedOnly`, só fontes com curadoria (D4).
 */
export function filterQueuePool(pool: QuestionMeta[], verifiedOnly?: boolean): QuestionMeta[] {
  return pool.filter((m) => !m.duplicate && (!verifiedOnly || m.sourceClass === "verificada"));
}

function poolFor(taskTypes?: TaskType[], verifiedOnly?: boolean): QuestionMeta[] {
  const base = filterQueuePool(readyMeta, verifiedOnly);
  return taskTypes?.length ? base.filter((m) => taskTypes.includes(m.taskType)) : base;
}

/** Filtro "só verificadas" corrente (Ajustes) — lido na hora de montar a fila. */
function currentVerifiedOnly(): boolean {
  return getStateSnapshot().settings.verifiedOnly;
}

/** Quantas questões estão vencidas para revisão (já tentadas e com `dueAt` no passado). */
export function countDue(
  stats: Map<string, QuestionStat>,
  now = Date.now(),
  verifiedOnly?: boolean,
): number {
  let n = 0;
  for (const m of filterQueuePool(readyMeta, verifiedOnly)) {
    const s = stats.get(m.id);
    if (s && s.dueAt <= now) n++;
  }
  return n;
}

/** Vencidas por task type (para badges por seção/tipo). */
export function countDueByType(
  stats: Map<string, QuestionStat>,
  now = Date.now(),
  verifiedOnly?: boolean,
): Map<TaskType, number> {
  const out = new Map<TaskType, number>();
  for (const m of filterQueuePool(readyMeta, verifiedOnly)) {
    const s = stats.get(m.id);
    if (!s || s.dueAt > now) continue;
    out.set(m.taskType, (out.get(m.taskType) ?? 0) + 1);
  }
  return out;
}

/** Quantas questões têm a última tentativa abaixo de ERROR_SCORE. */
export function countErrors(stats: Map<string, QuestionStat>, verifiedOnly?: boolean): number {
  let n = 0;
  for (const m of filterQueuePool(readyMeta, verifiedOnly)) {
    if (isErrorStat(stats.get(m.id), m.taskType)) n++;
  }
  return n;
}

/**
 * Fila inteligente (repetição espaçada):
 *  1. revisões vencidas (as de pior último score primeiro),
 *  2. questões novas (embaralhadas, intercaladas por tipo),
 *  3. o restante, da revisão mais próxima para a mais distante.
 * Revisões e novas entram na proporção 2:1; sempre intercalando task types.
 */
export function buildQueue(
  stats: Map<string, QuestionStat>,
  size: number,
  opts: QueueOptions = {},
): string[] {
  const now = opts.now ?? Date.now();
  const rand = opts.rand ?? Math.random;
  const pool = poolFor(opts.taskTypes, opts.verifiedOnly ?? false);

  if (opts.mode === "errors") {
    const errs = pool
      .filter((m) => isErrorStat(stats.get(m.id), m.taskType))
      .sort((a, b) => (stats.get(a.id)?.lastScore ?? 0) - (stats.get(b.id)?.lastScore ?? 0));
    return interleaveByType(errs)
      .slice(0, size)
      .map((m) => m.id);
  }

  if (opts.mode === "due") {
    const dueOnly = pool
      .filter((m) => {
        const s = stats.get(m.id);
        return !!s && s.dueAt <= now;
      })
      .sort((a, b) => {
        const sa = stats.get(a.id)!;
        const sb = stats.get(b.id)!;
        return (sa.lastScore ?? 0) - (sb.lastScore ?? 0) || sa.dueAt - sb.dueAt;
      });
    return interleaveByType(dueOnly)
      .slice(0, size)
      .map((m) => m.id);
  }

  const due: QuestionMeta[] = [];
  const fresh: QuestionMeta[] = [];
  const later: QuestionMeta[] = [];
  for (const m of pool) {
    const s = stats.get(m.id);
    if (!s) fresh.push(m);
    else if (s.dueAt <= now) due.push(m);
    else later.push(m);
  }
  due.sort((a, b) => {
    const sa = stats.get(a.id)!;
    const sb = stats.get(b.id)!;
    return (sa.lastScore ?? 0) - (sb.lastScore ?? 0) || sa.dueAt - sb.dueAt;
  });
  later.sort((a, b) => stats.get(a.id)!.dueAt - stats.get(b.id)!.dueAt);

  const dueQ = interleaveByType(due);
  const freshQ = interleaveByType(shuffle(fresh, rand));
  const laterQ = interleaveByType(later);

  const out: string[] = [];
  let di = 0;
  let fi = 0;
  while (out.length < size && (di < dueQ.length || fi < freshQ.length)) {
    for (let k = 0; k < 2 && di < dueQ.length && out.length < size; k++) out.push(dueQ[di++]!.id);
    if (fi < freshQ.length && out.length < size) out.push(freshQ[fi++]!.id);
    // sem novas: segue só com revisões (e vice-versa) sem travar o loop
    if (fi >= freshQ.length && di < dueQ.length && out.length < size) out.push(dueQ[di++]!.id);
  }
  for (let li = 0; out.length < size && li < laterQ.length; li++) out.push(laterQ[li]!.id);
  return out;
}

export type MixCounts = Partial<Record<TaskType, number>>;

function scoreKey(q: QuestionMeta, stats: Map<string, QuestionStat>): [number, number] {
  const s = stats.get(q.id);
  return [s?.bestContent ?? -1, s?.lastAttemptAt ?? 0];
}

/** Cotas por categoria (projeto 13, §4.2): a fila mista executa a recomendação
 * do plano do dia — revisões vencidas e questões novas por tipo, na ordem
 * recomendada, em vez de escolher pela melhor nota histórica. */
export interface MixedQuota {
  /** Revisões vencidas por tipo (parcela SRS do plano). */
  due?: MixCounts;
  /** Questões nunca tentadas por tipo (parcela nova do plano). */
  fresh?: MixCounts;
}

export interface MixedQueueInfo {
  ids: string[];
  /** Cota de vencidas que o estoque não cobriu (UI mostra "vencidas disponíveis: X de Y"). */
  dueShort: number;
  /** Cota de novas que o estoque não cobriu. */
  freshShort: number;
}

/** Embaralhamento determinístico por hash do id: o preview do seletor e a fila
 * real coincidem, então a duração exibida é a da fila que executa. */
function hashUnit(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Fila mista: para cada tipo escolhe as questões mais fracas/menos recentes;
 * os tipos com pior média vêm primeiro e são intercalados (round-robin).
 * Com `quota`, cada tipo executa a recomendação do plano: 1) vencidas (pior
 * último score primeiro), 2) novas (ordem estável), 3) o resto da cota pelo
 * critério histórico — fallback documentado quando o estoque não cobre a cota.
 */
export function buildMixedQueue(
  stats: Map<string, QuestionStat>,
  counts: MixCounts,
  pool: QuestionMeta[] = readyMeta,
  quota?: MixedQuota,
): MixedQueueInfo {
  const now = Date.now();
  const picked = new Set<string>();
  const picks: { type: TaskType; avg: number; ids: string[] }[] = [];
  let dueShort = 0;
  let freshShort = 0;

  for (const [type, n] of Object.entries(counts) as [TaskType, number][]) {
    if (!n || n <= 0) continue;
    const ofType = pool.filter((q) => q.taskType === type);
    if (!ofType.length) continue;
    const ids: string[] = [];
    const take = (list: QuestionMeta[]) => {
      for (const q of list) {
        picked.add(q.id);
        ids.push(q.id);
      }
    };

    // 1) Cota de vencidas: dueAt no passado, pior último score primeiro.
    const dueWanted = quota?.due?.[type] ?? 0;
    if (dueWanted > 0) {
      const due = ofType
        .filter((q) => !picked.has(q.id) && (stats.get(q.id)?.dueAt ?? Infinity) <= now)
        .sort(
          (a, b) =>
            (stats.get(a.id)?.lastScore ?? 0) - (stats.get(b.id)?.lastScore ?? 0) ||
            (stats.get(a.id)?.dueAt ?? 0) - (stats.get(b.id)?.dueAt ?? 0),
        )
        .slice(0, dueWanted);
      take(due);
      dueShort += dueWanted - due.length;
    }

    // 2) Cota de novas: nunca tentadas, ordem estável por hash do id.
    const freshWanted = quota?.fresh?.[type] ?? 0;
    if (freshWanted > 0) {
      const fresh = ofType
        .filter((q) => !picked.has(q.id) && !stats.has(q.id))
        .sort((a, b) => hashUnit(a.id) - hashUnit(b.id))
        .slice(0, freshWanted);
      take(fresh);
      freshShort += freshWanted - fresh.length;
    }

    // 3) Fallback documentado: completa a cota do tipo pelo critério histórico.
    const restWanted = n - ids.length;
    if (restWanted > 0) {
      const rest = ofType
        .filter((q) => !picked.has(q.id))
        .map((q) => ({ q, k: scoreKey(q, stats) }))
        .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || hashUnit(a.q.id) - hashUnit(b.q.id))
        .slice(0, restWanted);
      take(rest.map((x) => x.q));
    }
    if (!ids.length) continue;
    const scored = ofType.filter((q) => (stats.get(q.id)?.bestContent ?? -1) >= 0);
    const avg = scored.length
      ? scored.reduce((s, q) => s + (stats.get(q.id)?.bestContent ?? 0), 0) / scored.length
      : -1; // nunca treinado = mais fraco
    picks.push({ type, avg, ids });
  }
  picks.sort((a, b) => a.avg - b.avg);
  const out: string[] = [];
  for (let i = 0; picks.some((p) => i < p.ids.length); i++) {
    for (const p of picks) if (i < p.ids.length) out.push(p.ids[i]!);
  }
  return { ids: out, dueShort, freshShort };
}

/** Preview puro da fila mista (duração/avisos do seletor, sem iniciar sessão). */
export function previewMixedQueue(
  counts: MixCounts,
  stats: Map<string, QuestionStat>,
  verifiedOnly?: boolean,
  quota?: MixedQuota,
): MixedQueueInfo {
  return buildMixedQueue(stats, counts, poolFor(undefined, verifiedOnly), quota);
}

function begin(queue: string[], kind: SessionKind = "srs", label = "Sessão") {
  state = {
    active: true,
    size: queue.length,
    queue,
    index: 0,
    startedAt: Date.now(),
    results: [],
    skips: 0,
    kind,
    label,
    archived: false,
  };
  saveSessionDraft(toDraft(state));
  emit();
}

/** Extrai o draft persistível do estado em memória. */
function toDraft(s: SessionState) {
  return {
    kind: s.kind,
    label: s.label,
    queue: s.queue,
    index: s.index,
    startedAt: s.startedAt,
    results: s.results,
    skips: s.skips,
  };
}

/** Arquiva a sessão no histórico (uma única vez). */
function archive(s: SessionState) {
  if (s.archived || s.results.length === 0) return;
  addSessionRecord({
    startedAt: s.startedAt,
    finishedAt: Date.now(),
    kind: s.kind,
    label: s.label,
    results: s.results,
  });
  state = { ...state, archived: true };
}

export function startSession(size: number, stats: Map<string, QuestionStat>, opts?: QueueOptions) {
  const kind: SessionKind = opts?.mode === "errors" ? "errors" : "srs";
  const label = opts?.mode === "errors" ? `Revisar erros (${size})` : `Sessão de ${size}`;
  begin(buildQueue(stats, size, { verifiedOnly: currentVerifiedOnly(), ...opts }), kind, label);
}

/**
 * Sessão de erros com qids EXATOS (projeto 13, §1.6): a fila é a lista dada —
 * não reconstrói por `lastScore`, então revisar os erros DE UM EXAME revisa
 * exatamente aquele exame. Dedupe preservando ordem; só qids com motor de
 * prática; sem fila, nada acontece (a UI omitirá a ação).
 */
export function startErrorsSessionForQids(qids: string[], label?: string): number {
  const seen = new Set<string>();
  const ready = new Set(readyMeta.map((m) => m.id));
  const queue = qids.filter((q) => {
    if (seen.has(q) || !ready.has(q)) return false;
    seen.add(q);
    return true;
  });
  if (queue.length === 0) return 0;
  begin(queue, "errors", label ?? `Revisar erros do exame (${queue.length})`);
  return queue.length;
}

export interface MixedStartResult {
  /** Tamanho real da fila iniciada (pode ser menor que a cota pedida). */
  size: number;
  /** Cota de vencidas que o estoque não cobriu (§4.2, fallback documentado). */
  dueShort: number;
  /** Cota de novas que o estoque não cobriu. */
  freshShort: number;
}

/** Sessão mista: sem cota, escolhe pelo histórico; com cota (plano do dia),
 * executa a recomendação — vencidas primeiro, depois novas, por tipo. */
export function startMixedSession(
  counts: MixCounts,
  stats: Map<string, QuestionStat>,
  quota?: MixedQuota,
): MixedStartResult {
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const built = buildMixedQueue(stats, counts, poolFor(undefined, currentVerifiedOnly()), quota);
  if (built.ids.length > 0) begin(built.ids, "mixed", `Mista de ${total}`);
  return { size: built.ids.length, dueShort: built.dueShort, freshShort: built.freshShort };
}

/** Fila do dia: só revisões vencidas, pior último score primeiro. */
export function startDueSession(size: number, stats: Map<string, QuestionStat>) {
  begin(
    buildQueue(stats, size, { mode: "due", verifiedOnly: currentVerifiedOnly() }),
    "due",
    `Fila do dia (${size})`,
  );
}

export function isSessionItem(qid: string): boolean {
  return state.active && state.queue.includes(qid);
}

/** Próxima questão da sessão (undefined se encerrada ou concluída). */
export function sessionNextId(): string | undefined {
  if (!state.active) return undefined;
  return state.queue[state.index];
}

/** Registra o resultado da questão atual e avança a fila. Um resultado de
 * outra questão não avança a sessão (projeto 13, §4.2 — o caminho do Read
 * Aloud e o do shell convergem aqui, com validação única de qid). */
export function completeSessionItem(result: SessionResult) {
  if (!state.active) return;
  if (state.queue[state.index] !== result.qid) return;
  state = { ...state, index: state.index + 1, results: [...state.results, result] };
  if (sessionFinished()) {
    archive(state);
    clearSessionDraft();
  } else {
    saveSessionDraft(toDraft(state));
  }
  emit();
}

export type SkipReason = "asr" | "technical";

/** Pula a questão atual com motivo (projeto 13, §4.2): volta ao FIM da fila
 * sem penalidade de score e sem contar como concluída (reagendada). Se for a
 * última restante, a sessão encerra sem registrar resultado para ela. */
export function skipSessionItem(_reason: SkipReason): void {
  if (!state.active) return;
  const qid = state.queue[state.index];
  if (!qid) return;
  const rest = state.queue.slice(state.index + 1);
  const skips = state.skips + 1;
  if (rest.length === 0) {
    state = { ...state, index: state.index + 1, skips };
    archive(state);
    clearSessionDraft();
    emit();
    return;
  }
  state = {
    ...state,
    queue: [...state.queue.slice(0, state.index), ...rest, qid],
    skips,
  };
  saveSessionDraft(toDraft(state));
  emit();
}

export function sessionFinished(): boolean {
  return state.active && state.index >= state.queue.length;
}

export function endSession() {
  if (state.active) {
    archive(state);
    clearSessionDraft();
  }
  state = IDLE;
  emit();
}

// Retomada: se havia um draft de sessão, restaura o estado em memória.
{
  const draft = getSessionDraft();
  if (draft) {
    state = {
      active: true,
      size: draft.queue.length,
      queue: draft.queue,
      index: draft.index,
      startedAt: draft.startedAt,
      results: draft.results,
      skips: draft.skips ?? 0,
      kind: draft.kind,
      label: draft.label,
      archived: draft.index >= draft.queue.length,
    };
  }
}

const getSnapshot = () => state;

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, () => IDLE);
}
