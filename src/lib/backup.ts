// Backup v7: prévia, mescla e desfazer (projeto 9, Fase 1 — corrige A3).
// `importBackup` (storage.ts) continua substituindo, mas agora guarda o estado
// anterior em UNDO_KEY. Aqui ficam as operações puras + o undo.
// Projeto 10: o vocabulário entra no envelope (v7) e na mescla (D10).
// Projeto 13 (D2/D3/D4): mescla IDEMPOTENTE — tentativas deduplicadas por
// identidade determinística, snapshots/agregados reconciliados por evidência
// (reimportar o MESMO backup não infla mais nada), settings locais vencem no
// merge, e o undo tem durabilidade confirmada (nunca é removido antes da
// gravação da restauração).
import {
  MAX_ATTEMPTS,
  MAX_SESSIONS,
  STATE_VERSION,
  UNDO_KEY,
  flushPendingWrite,
  getStateSnapshot,
  migrateLegacyState,
  replaceState,
  type AppState,
  type Attempt,
  type DailyAggregate,
  type QuestionSnapshot,
  type SessionRecord,
} from "@/lib/storage";
import {
  MAX_VOCAB_SOURCES,
  type VocabPhrase,
  type VocabSource,
  type VocabStore,
  type VocabWord,
} from "@/lib/plus/vocab";

const BACKUP_APP = "pte-master-hub";
const BACKUP_VERSIONS = [2, 3, 4, 5, 6, 7];

export interface BackupPreview {
  version: number;
  exportedAt: string | null;
  attempts: number;
  firstAttempt: string | null;
  lastAttempt: string | null;
  bookmarks: number;
  notes: number;
  sessions: number;
  questions: number;
  /** Projeto 10: vocabulário vindo no backup (palavras · frases). */
  vocabWords: number;
  vocabPhrases: number;
  targetScore: number;
  dailyGoal: number;
}

function parseBackup(json: string):
  | { ok: true; state: AppState; exportedAt: string | null }
  | {
      ok: false;
      error: string;
    } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "o arquivo não é um JSON válido" };
  }
  const obj = parsed as Record<string, unknown>;
  const isCurrent = obj["app"] === BACKUP_APP && BACKUP_VERSIONS.includes(obj["version"] as number);
  const isLegacy = obj["app"] === "readaloud-trainer";
  if (!isCurrent && !isLegacy) {
    return { ok: false, error: "este arquivo não é um backup deste app" };
  }
  if (!Array.isArray(obj["attempts"])) {
    return { ok: false, error: "histórico de tentativas inválido" };
  }
  if (!Array.isArray(obj["bookmarks"])) {
    return { ok: false, error: "lista de favoritos inválida" };
  }
  const state = migrateLegacyState(parsed);
  return {
    ok: true,
    state,
    exportedAt: typeof obj["exportedAt"] === "string" ? obj["exportedAt"] : null,
  };
}

/** Valida e resume o backup para a UI confirmar ANTES de aplicar. */
export function previewBackup(
  json: string,
): { ok: true; preview: BackupPreview } | { ok: false; error: string } {
  const parsed = parseBackup(json);
  if (!parsed.ok) return parsed;
  const { state, exportedAt } = parsed;
  const stamps = state.attempts.map((a) => a.ts).filter((t) => t > 0);
  const firstAttempt = stamps.length
    ? new Date(Math.min(...stamps)).toISOString().slice(0, 10)
    : null;
  const lastAttempt = stamps.length
    ? new Date(Math.max(...stamps)).toISOString().slice(0, 10)
    : null;
  return {
    ok: true,
    preview: {
      version: state.version,
      exportedAt,
      attempts: state.attempts.length,
      firstAttempt,
      lastAttempt,
      bookmarks: state.bookmarks.length,
      notes: Object.keys(state.notes).length,
      sessions: state.sessions.length,
      questions: Object.keys(state.questions).length,
      vocabWords: Object.keys(state.vocabulary?.words ?? {}).length,
      vocabPhrases: Object.keys(state.vocabulary?.phrases ?? {}).length,
      targetScore: state.settings.targetScore,
      dailyGoal: state.settings.dailyGoal,
    },
  };
}

// ---------- identidade de tentativa (projeto 13, D2) ----------

/**
 * Identidade DETERMINÍSTICA de uma tentativa (hash lógico, sem criptografia).
 * Duas tentativas com a mesma chave são o mesmo evento — reimportar o mesmo
 * backup não pode criar uma "segunda" tentativa. Nenhuma migração de schema:
 * a chave é derivada na hora a partir do conteúdo estável da tentativa.
 */
export function attemptKey(a: Attempt): string {
  const metrics = a.metrics
    ? Object.entries(a.metrics)
        .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join("|")
    : "";
  const tags = a.tags ? [...a.tags].sort().join("|") : "";
  return [
    a.qid,
    a.ts,
    a.taskType,
    a.mode,
    a.score ?? a.contentScore ?? "",
    a.wpm ?? "",
    a.durationMs,
    tags,
    metrics,
  ].join("§");
}

function keySetsByQid(attempts: Attempt[]): Map<string, Set<string>> {
  const byQid = new Map<string, Set<string>>();
  for (const a of attempts) {
    let set = byQid.get(a.qid);
    if (!set) {
      set = new Set<string>();
      byQid.set(a.qid, set);
    }
    set.add(attemptKey(a));
  }
  return byQid;
}

/** Fusão determinística de snapshots, reconciliada por evidência (D4). */
function mergeSnapshot(
  a: QuestionSnapshot,
  b: QuestionSnapshot,
  shared: boolean,
): QuestionSnapshot {
  const newer = b.lastAttemptAt >= a.lastAttemptAt ? b : a;
  const older = newer === a ? b : a;
  return {
    // Idempotência: quando os dois lados compartilham tentativas (mesmo
    // backup reimportado), os contadores NÃO somam — o lado mais recente
    // é a evidência viva. Sem interseção, a união é real (dispositivos
    // com históricos disjuntos) e somar é correto.
    attempts: shared ? newer.attempts : a.attempts + b.attempts,
    bestScore: maxNullable(a.bestScore, b.bestScore),
    bestWpm: maxNullable(a.bestWpm, b.bestWpm),
    lastScore: newer.lastScore,
    lastAttemptAt: newer.lastAttemptAt,
    strongAttempts: shared ? newer.strongAttempts : a.strongAttempts + b.strongAttempts,
    // Fase 2: tentativas fortes COM a questão vencida — mesma política dos
    // contadores acima; máximos preservam o gate anti-maratona.
    dueStrongAttempts: shared
      ? Math.max(newer.dueStrongAttempts ?? 0, older.dueStrongAttempts ?? 0)
      : Math.max(a.dueStrongAttempts ?? 0, b.dueStrongAttempts ?? 0),
    prevStrong: newer.prevStrong ?? false,
    lastAttemptDue: newer.lastAttemptDue ?? false,
    // D4: caixa/prazo vêm do lado com a tentativa MAIS RECENTE — um lapso
    // recente vence uma promoção antiga (o máximo puro mentia).
    box: newer.box,
    dueAt: newer.dueAt,
  };
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

function dayKeyOf(ts: number): string {
  // Mesma chave de dia do storage (calendário local) sem importar API privada:
  // deriva de um `Date` local, igual a `dayKey` em storage.ts.
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

interface SideCounts {
  cur?: { all: number };
  inc?: { all: number };
}

/**
 * Mescla agregados diários com evidência (D2): quando o log de um dos lados
 * cobre integralmente o dia dele, o dia é RECALCULADO da união deduplicada
 * de tentativas — reimportar o mesmo backup não soma duas vezes. Sem
 * cobertura, cai na soma conservadora (dias disjuntos somam corretamente).
 */
function mergeDaily(
  cur: Record<string, DailyAggregate>,
  inc: Record<string, DailyAggregate>,
  attemptsByDay: Map<string, Attempt[]>,
  sideCounts: Map<string, SideCounts>,
): Record<string, DailyAggregate> {
  const out: Record<string, DailyAggregate> = { ...cur };
  for (const k of new Set([...Object.keys(cur), ...Object.keys(inc)])) {
    const c = cur[k];
    const i = inc[k];
    if (!c && !i) continue;
    const dayAttempts = attemptsByDay.get(k) ?? [];
    const counts = sideCounts.get(k);
    const coveredCur = !!c && counts?.cur?.all === c.attempts;
    const coveredInc = !!i && counts?.inc?.all === i.attempts;
    if (coveredCur || coveredInc) {
      const scored = dayAttempts.filter((a) => (a.score ?? a.contentScore) !== null);
      out[k] = {
        attempts: dayAttempts.length,
        scored: scored.length,
        sum: scored.reduce((s, a) => s + (a.score ?? a.contentScore ?? 0), 0),
      };
      continue;
    }
    const base = c ?? { attempts: 0, scored: 0, sum: 0 };
    const add = i ?? { attempts: 0, scored: 0, sum: 0 };
    out[k] = {
      attempts: base.attempts + add.attempts,
      scored: base.scored + add.scored,
      sum: base.sum + add.sum,
    };
  }
  return out;
}

/**
 * Mescla o backup com o estado atual (nada do atual é perdido):
 * tentativas = união DEDUPLICADA por identidade (idempotente);
 * snapshots/agregados = reconciliados por evidência; favoritos = união;
 * notas = a mais recente vence; sessões = união por id;
 * ajustes = os LOCAIS vencem no merge (D3 — trocar sotaque/meta por
 * surpresa era efeito colateral do merge de progresso).
 */
export function mergeStates(current: AppState, incoming: AppState): AppState {
  const union = [...current.attempts, ...incoming.attempts].sort((x, y) => x.ts - y.ts);
  const seen = new Set<string>();
  const deduped: Attempt[] = [];
  for (const a of union) {
    const k = attemptKey(a);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(a);
  }
  const attempts = deduped.slice(-MAX_ATTEMPTS);

  const attemptsByDay = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const k = dayKeyOf(a.ts);
    const list = attemptsByDay.get(k) ?? [];
    list.push(a);
    attemptsByDay.set(k, list);
  }
  const sideCounts = new Map<string, SideCounts>();
  for (const k of new Set([...Object.keys(current.daily), ...Object.keys(incoming.daily)])) {
    sideCounts.set(k, {
      cur: { all: current.attempts.filter((a) => dayKeyOf(a.ts) === k).length },
      inc: { all: incoming.attempts.filter((a) => dayKeyOf(a.ts) === k).length },
    });
  }

  const curKeys = keySetsByQid(current.attempts);
  const incKeys = keySetsByQid(incoming.attempts);

  const questions: Record<string, QuestionSnapshot> = { ...current.questions };
  for (const [qid, snap] of Object.entries(incoming.questions)) {
    const cur = questions[qid];
    if (!cur) {
      questions[qid] = snap;
      continue;
    }
    const shared = [...(curKeys.get(qid) ?? [])].some((k) => incKeys.get(qid)?.has(k));
    questions[qid] = mergeSnapshot(cur, snap, shared);
  }

  const bookmarks = [...new Set([...current.bookmarks, ...incoming.bookmarks])];

  const notes = { ...current.notes };
  for (const [qid, note] of Object.entries(incoming.notes)) {
    const cur = notes[qid];
    if (!cur || note.updatedAt >= cur.updatedAt) notes[qid] = note;
  }

  const sessionsMap = new Map<string, SessionRecord>();
  for (const s of [...current.sessions, ...incoming.sessions]) {
    const prev = sessionsMap.get(s.id);
    if (!prev || s.finishedAt > prev.finishedAt) sessionsMap.set(s.id, s);
  }
  const sessions = [...sessionsMap.values()]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, MAX_SESSIONS);

  const draft =
    (current.draft?.startedAt ?? 0) >= (incoming.draft?.startedAt ?? 0)
      ? current.draft
      : incoming.draft;

  // Projeto 13 (D5): o draft do simulado mais recente vence (o backup não
  // carrega drafts — na prática é o local; a regra cobre estados legados).
  const examDraft =
    (current.examDraft?.startedAt ?? 0) >= (incoming.examDraft?.startedAt ?? 0)
      ? (current.examDraft ?? null)
      : (incoming.examDraft ?? null);

  // Projeto 13 (§4.3): o draft da revisão de vocabulário mais recente vence
  // (mesma regra dos demais drafts — o backup não carrega drafts em uso).
  const vocabDraft =
    (current.vocabDraft?.startedAt ?? 0) >= (incoming.vocabDraft?.startedAt ?? 0)
      ? (current.vocabDraft ?? null)
      : (incoming.vocabDraft ?? null);

  /**
   * Mescla vocabulários (nada do atual é perdido): por item, o gesto mais
   * recente vence na tradução/nota; gestos (seenCount) somam; fontes unem
   * (dedupe, cap MAX_VOCAB_SOURCES); caixa/prazo ficam com o mais avançado
   * (conservador — a revisão mais distante sobrevive); favorito vence ligado.
   */
  function mergeVocabStores(current: VocabStore, incoming: VocabStore): VocabStore {
    const words: Record<string, VocabWord> = { ...current.words };
    for (const [key, w] of Object.entries(incoming.words)) {
      const cur = words[key];
      words[key] = cur ? mergeVocabWord(cur, w) : w;
    }
    const phrases: Record<string, VocabPhrase> = { ...current.phrases };
    for (const [key, p] of Object.entries(incoming.phrases)) {
      const cur = phrases[key];
      phrases[key] = cur ? mergeVocabPhrase(cur, p) : p;
    }
    return { words, phrases };
  }

  function mergeSources(a: VocabSource[], b: VocabSource[]): VocabSource[] {
    const out = [...a];
    for (const s of b) {
      if (!out.some((x) => x.type === s.type && x.qid === s.qid)) out.push(s);
    }
    return out.slice(-MAX_VOCAB_SOURCES);
  }

  function mergeVocabWord(a: VocabWord, b: VocabWord): VocabWord {
    const newer = b.lastSeenAt >= a.lastSeenAt ? b : a;
    return {
      ...newer,
      savedAt: Math.min(a.savedAt || newer.savedAt, b.savedAt || newer.savedAt),
      lastSeenAt: Math.max(a.lastSeenAt, b.lastSeenAt),
      seenCount: a.seenCount + b.seenCount,
      sources: mergeSources(a.sources, b.sources),
      box: Math.max(a.box, b.box),
      dueAt: Math.max(a.dueAt, b.dueAt),
      ...(a.starred === true || b.starred === true ? { starred: true } : {}),
    };
  }

  function mergeVocabPhrase(a: VocabPhrase, b: VocabPhrase): VocabPhrase {
    const newer = b.lastSeenAt >= a.lastSeenAt ? b : a;
    return {
      ...newer,
      savedAt: Math.min(a.savedAt || newer.savedAt, b.savedAt || newer.savedAt),
      lastSeenAt: Math.max(a.lastSeenAt, b.lastSeenAt),
      seenCount: a.seenCount + b.seenCount,
      box: Math.max(a.box, b.box),
      dueAt: Math.max(a.dueAt, b.dueAt),
      ...(a.starred === true || b.starred === true ? { starred: true } : {}),
    };
  }

  const vocabulary = mergeVocabStores(
    current.vocabulary ?? { words: {}, phrases: {} },
    incoming.vocabulary ?? { words: {}, phrases: {} },
  );

  return {
    version: STATE_VERSION,
    srsRules: 2,
    attempts,
    questions,
    daily: mergeDaily(current.daily, incoming.daily, attemptsByDay, sideCounts),
    bookmarks,
    notes,
    sessions,
    draft,
    examDraft,
    vocabDraft,
    vocabulary,
    // D3: merge mantém os AJUSTES LOCAIS; só o replace troca ajustes.
    settings: current.settings,
  };
}

export interface MergePreviewCounts {
  attempts: { before: number; after: number };
  questions: { before: number; after: number };
  sessions: { before: number; after: number };
  bookmarks: { before: number; after: number };
  notes: { before: number; after: number };
  vocabWords: { before: number; after: number };
  vocabPhrases: { before: number; after: number };
  /** Política de ajustes aplicada (D3): "locais" no merge, "do backup" no replace. */
  settingsPolicy: string;
}

/** Prévia da MESCLA: contagens antes/depois, sem aplicar nada (D3). */
export function previewMergeStates(current: AppState, incoming: AppState): MergePreviewCounts {
  const merged = mergeStates(current, incoming);
  const count = (r: Record<string, unknown>) => Object.keys(r).length;
  return {
    attempts: { before: current.attempts.length, after: merged.attempts.length },
    questions: {
      before: count(current.questions),
      after: count(merged.questions),
    },
    sessions: { before: current.sessions.length, after: merged.sessions.length },
    bookmarks: { before: current.bookmarks.length, after: merged.bookmarks.length },
    notes: { before: count(current.notes), after: count(merged.notes) },
    vocabWords: {
      before: count(current.vocabulary?.words ?? {}),
      after: count(merged.vocabulary?.words ?? {}),
    },
    vocabPhrases: {
      before: count(current.vocabulary?.phrases ?? {}),
      after: count(merged.vocabulary?.phrases ?? {}),
    },
    settingsPolicy: "locais",
  };
}

export type ApplyBackupResult =
  { ok: true; undoSaved: boolean } | { ok: false; error: string; undoSaved: false };

/**
 * Aplica o backup (replace: substitui; merge: mescla). Guarda o estado
 * anterior para o undo. Projeto 13 (§0.2):
 *  - se o UNDO não couber, a operação NÃO segue em silêncio: devolve
 *    `{ ok: false, error: "sem-undo" }` e a UI decide (confirmação explícita
 *    com `allowWithoutUndo` ou cancelamento);
 *  - `ok: true` só é devolvido depois da gravação REAL do novo estado
 *    (flush confirmado) — sucesso anunciado é estado durável;
 *  - o undo NUNCA é removido antes da gravação da restauração confirmar.
 */
export function applyBackup(
  json: string,
  mode: "replace" | "merge",
  opts: { allowWithoutUndo?: boolean } = {},
): ApplyBackupResult {
  const parsed = parseBackup(json);
  if (!parsed.ok) return { ok: false, error: parsed.error, undoSaved: false };
  if (typeof window === "undefined") return { ok: false, error: "sem navegador", undoSaved: false };
  let undoSaved = false;
  try {
    flushPendingWrite();
    window.localStorage.setItem(UNDO_KEY, JSON.stringify(getStateSnapshot()));
    undoSaved = true;
  } catch {
    /* sem espaço para o undo — ver política abaixo */
  }
  if (!undoSaved && !opts.allowWithoutUndo) {
    return { ok: false, error: "sem-undo", undoSaved: false };
  }
  const next = mode === "merge" ? mergeStates(getStateSnapshot(), parsed.state) : parsed.state;
  replaceState({
    ...next,
    settings: { ...next.settings, lastBackupAt: Date.now() },
  });
  // Durabilidade: a gravação agendada acontece AGORA; o sucesso anunciado
  // pela UI corresponde ao estado realmente persistido.
  flushPendingWrite();
  return { ok: true, undoSaved };
}

/** Restaura o estado guardado antes do último import. */
export function undoBackup(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(UNDO_KEY);
  if (!raw) return false;
  try {
    const restored = migrateLegacyState(JSON.parse(raw) as unknown);
    replaceState(restored);
    // A gravação da restauração é confirmada ANTES de descartar o undo:
    // um crash entre replace e remove não perde nem o novo nem o antigo.
    flushPendingWrite();
    window.localStorage.removeItem(UNDO_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasUndoBackup(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(UNDO_KEY) !== null;
}
