// Persistência local do progresso — AppState v7.
//
// Projeto 9, Fase 1 (integridade). Mudanças vs. v5:
//  - `questions`: snapshot SRS/estatístico POR QUESTÃO — fonte de verdade que
//    sobrevive ao corte do log de tentativas (corrige A1: o teto MAX_ATTEMPTS
//    nunca mais apaga caixa/dueAt/dominada).
//  - `daily`: agregados por dia local (streak/médias) — iteração por chave de
//    dia, sem passo fixo de 24 h (corrige A5).
//  - Estado ilegível vai para QUARENTENA (cópia bruta) e nunca é sobrescrito;
//    versão futura (v7+) fica em modo somente-leitura (corrige A2).
//  - Import: `importBackup` guarda o estado anterior em chave de UNDO antes de
//    substituir; prévia/mescla ficam em `src/lib/backup.ts` (corrige A3).
//  - Escrita coalescida por microtask, aviso preventivo de quota,
//    navigator.storage.persist() e lembrete de backup (corrige A4).

import { useSyncExternalStore } from "react";

import { dayKey, lastDayKeys, shiftDayKey } from "@/lib/dates";
import type { ExamResultCause, ExamResultRow } from "@/lib/pte/exam";
import {
  applyVocabStudy as applyVocabStudyPure,
  clearVocabAll as clearVocabAllPure,
  emptyVocabStore,
  normalizeVocabStore,
  removeVocabItem as removeVocabItemPure,
  saveVocabPhrase as saveVocabPhrasePure,
  saveVocabWord as saveVocabWordPure,
  toggleVocabStar as toggleVocabStarPure,
  type SaveVocabPhraseInput,
  type SaveVocabWordInput,
  type VocabKind,
  type VocabStore,
} from "@/lib/plus/vocab";
import { canonicalIdOf } from "@/lib/pte/manifest";
import type { TaskType } from "@/lib/pte/types";

export type Accent = "en-AU" | "en-US" | "en-GB";

export interface Attempt {
  qid: string;
  ts: number;
  taskType: TaskType;
  mode: "speech" | "manual";
  /**
   * Projeto 13 (D2): identidade estável da tentativa — base do dedupe de
   * merge. Opcional: registros legados derivam a chave deterministicamente
   * em `attemptKey` (backup.ts), sem migração de schema.
   */
  id?: string;
  /** Legado Read Aloud — manter para compatibilidade. */
  contentScore: number | null;
  /** Score geral 0-100 de qualquer motor (fallback: contentScore). */
  score: number | null;
  wpm: number | null;
  durationMs: number;
  /** Métricas específicas por tipo (ex.: wpm, lacunas acertadas, saldo líquido). */
  metrics?: Record<string, number>;
  /** Rótulos de erro específicos (palavras erradas `missed:*`, trap, categoria). */
  tags?: string[];
}

/** Snapshot SRS/estatístico de uma questão — sobrevive ao corte do log. */
export interface QuestionSnapshot {
  /** Tentativas COM score (as sem score não contam, como na derivação v5). */
  attempts: number;
  bestScore: number | null;
  bestWpm: number | null;
  lastScore: number | null;
  lastAttemptAt: number;
  /** Tentativas fortes (≥ STRONG_SCORE) acumuladas. */
  strongAttempts: number;
  /** Fase 2: tentativas fortes feitas COM a questão vencida (qualificam dominada). */
  dueStrongAttempts: number;
  /** Fase 2: a tentativa anterior à última foi forte? (critério "duas últimas fortes"). */
  prevStrong: boolean;
  /** Fase 2: a última tentativa foi feita com a questão vencida? */
  lastAttemptDue: boolean;
  /** Caixa de repetição espaçada (Leitner, 0–5). */
  box: number;
  /** Quando a questão volta a "vencer" para revisão (ms). */
  dueAt: number;
}

/** Agregado diário para streak/médias — independe do log truncável. */
export interface DailyAggregate {
  /** Todas as tentativas do dia (com ou sem score). */
  attempts: number;
  /** Tentativas com score. */
  scored: number;
  /** Soma dos scores (média = sum/scored). */
  sum: number;
}

/** Recursos do pack "studie-plus" (extra de estudo — fora da replicação do PTE). */
export interface PlusSettings {
  /** Tradução por palavra (tipo 1): tocar numa palavra mostra literal + contexto. */
  wordTranslation: boolean;
  /** Tradução por frase (tipo 2): tocar no bloco expande literal + contextual. */
  phraseTranslation: boolean;
  /** Projeto 11: usa IA online para traduzir no momento do click (default ligado). */
  aiTranslation: boolean;
  /** Áudio de pronúncia do pack em textos sem áudio nativo. */
  plusAudio: boolean;
  /** Projeto 10: salvar no vocabulário tudo que o aluno traduz (default ligado). */
  vocabCapture: boolean;
}

export interface Settings {
  prepSeconds: number; // 0 = sem contagem
  dailyGoal: number;
  modelRate: number;
  accent: Accent;
  /** Data da prova ("YYYY-MM-DD") ou null = sem meta declarada. */
  examDate: string | null;
  /** Pontuação-alvo PTE (10–90). */
  targetScore: number;
  /** Última vez que o usuário exportou/importou um backup (ms) — lembrete. */
  lastBackupAt: number | null;
  /** 1º uso do microfone já explicado (aviso de privacidade do reconhecimento). */
  micNoticeSeen: boolean;
  /** D4: filas só com fontes verificadas (Ajustes; desligado por padrão — WFD/RS
   *  não têm fonte verificada; listas sempre mostram tudo, com selo). */
  verifiedOnly: boolean;
  /** Pack studie-plus — desligado por padrão. */
  plus: PlusSettings;
}

export interface SessionResult {
  qid: string;
  score: number | null;
  wpm: number | null;
}

/** Tipos de sessão registráveis no histórico. */
export type SessionKind = "srs" | "mixed" | "errors" | "due" | "exam";

/** Sessão concluída (ou encerrada com resultados), arquivada no histórico. */
export interface SessionRecord {
  id: string;
  startedAt: number;
  finishedAt: number;
  kind: SessionKind;
  label: string;
  results: SessionResult[];
}

/** Sessão em andamento — persistida para permitir retomada após reload. */
export interface SessionDraft {
  kind: SessionKind;
  label: string;
  queue: string[];
  index: number;
  startedAt: number;
  results: SessionResult[];
  /** Questões puladas com motivo (reagendadas, sem score — projeto 13, §4.2). */
  skips?: number;
}

/** Modalidade do simulado (seção, mini ou completo) — tipo espelhado de exam.ts. */
export type ExamId = "speaking" | "writing" | "reading" | "listening" | "mini" | "full";

/**
 * Simulado em andamento — persistido para retomada após reload (projeto 13, D5,
 * mesmo padrão do draft de sessão). Fila de qids (não objetos): a questão é
 * recarregada por id na retomada; removida do banco vira erro recuperável.
 * `deadlineAt` é ABSOLUTO (ms epoch): o relógio não deriva com a aba suspensa.
 */
export interface ExamDraft {
  examId: ExamId;
  queue: string[];
  index: number;
  /** Resultados das questões já concluídas, com causa e resposta (§1.5/§1.6). */
  results: ExamResultRow[];
  phase: "running" | "summary";
  /** Deadline absoluto da questão atual (ms epoch). */
  deadlineAt: number;
  startedAt: number;
}

/** Nota de texto livre por questão (chave do mapa = qid). */
export interface QuestionNote {
  text: string;
  updatedAt: number;
}

export interface AppState {
  version: 7;
  /** Regras de SRS vigentes nos snapshots (2 = Fase 2; ausente/1 → recalcular). */
  srsRules: 2;
  /** LOG de tentativas — truncável (teto MAX_ATTEMPTS), só auditoria. */
  attempts: Attempt[];
  /** Snapshot por questão (qid → QuestionSnapshot) — fonte de verdade do SRS. */
  questions: Record<string, QuestionSnapshot>;
  /** Agregados por dia local "YYYY-MM-DD". */
  daily: Record<string, DailyAggregate>;
  bookmarks: string[];
  notes: Record<string, QuestionNote>;
  sessions: SessionRecord[];
  draft: SessionDraft | null;
  /** Projeto 13 (D5): simulado em andamento — retomável após reload. */
  examDraft?: ExamDraft | null;
  /** Projeto 13 (§4.3): revisão de vocabulário em andamento — retomável após reload. */
  vocabDraft?: VocabReviewDraft | null;
  /** Projeto 10: vocabulário do pack — tudo que o aluno traduziu, com contexto. */
  vocabulary: VocabStore;
  settings: Settings;
}

/** Draft leve da revisão de vocabulário (§4.3): fila por chaves + placar —
 * os cartões são reconstruídos do store atual na retomada. */
export interface VocabReviewDraft {
  startedAt: number;
  queue: { kind: VocabKind; key: string }[];
  index: number;
  sim: number;
  nao: number;
  /** Chaves já reagendadas (uma repetição por item por sessão). */
  requeued: string[];
}

export interface QuestionStat {
  attempts: number;
  bestContent: number | null;
  bestWpm: number | null;
  lastAttemptAt: number;
  /** Score da tentativa mais recente. */
  lastScore: number | null;
  /** Quantas tentativas atingiram o score de "forte" (>= STRONG_SCORE). */
  strongAttempts: number;
  /** Fase 2: tentativas fortes feitas com a questão vencida (0 quando ausente). */
  dueStrongAttempts?: number;
  /** Fase 2: a tentativa anterior à última foi forte? */
  prevStrong?: boolean;
  /** Fase 2: a última tentativa foi feita com a questão vencida? */
  lastAttemptDue?: boolean;
  /** Caixa de repetição espaçada (Leitner, 0–5). */
  box: number;
  /** Quando a questão volta a "vencer" para revisão (ms). */
  dueAt: number;
}

/** Score a partir do qual uma tentativa conta como acerto na repetição espaçada
 *  (fallback para tipos sem entrada na tabela por tipo). */
export const PASS_SCORE = 80;

/**
 * Limiar de acerto POR TIPO (Fase 2, decisão D12 do PRD): calibrado pela natureza
 * da tarefa — ditados mais estritos, retenção de conteúdo menos.
 */
export const PASS_SCORE_BY_TYPE: Record<TaskType, number> = {
  // Ditados — mais estritos (85)
  wfd: 85,
  lst_fib: 85,
  // Leitura/repetição em voz alta (80)
  read_aloud: 80,
  repeat_sentence: 80,
  // Retenção de conteúdo — resumos, retell e ensaio (70)
  summarize_spoken_text: 70,
  retell_lecture: 70,
  swt: 70,
  write_essay: 70,
  lst_summary: 70,
  // Fase 7 (projeto 9): resumo falado e fala situacional — retenção de conteúdo (70)
  summarize_group_discussion: 70,
  respond_to_situation: 70,
  describe_image: 70,
  // Múltipla escolha, lacunas e reordenar (75)
  answer_short: 75,
  mcq_single: 75,
  mcq_multi: 75,
  reorder_paragraphs: 75,
  read_fib: 75,
  lst_hiw: 75,
  lst_hcs: 75,
  lst_smw: 75,
  lst_mcq: 75,
  lst_mcq_multi: 75,
};

export function passScoreFor(taskType: TaskType): number {
  return PASS_SCORE_BY_TYPE[taskType] ?? PASS_SCORE;
}
/** Score de uma tentativa "forte" (base do critério de dominada). */
export const STRONG_SCORE = 90;
/** Intervalo (dias) até a próxima revisão, por caixa Leitner. */
export const SRS_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;

export const STATE_VERSION = 7;
/** Teto do LOG de tentativas (as mais antigas saem primeiro) — só auditoria:
 *  o snapshot em `questions` NUNCA é derivado deste log. */
export const MAX_ATTEMPTS = 2000;
/** Teto de sessões arquivadas no histórico (as mais antigas saem primeiro). */
export const MAX_SESSIONS = 100;
/** Dias de agregados diários retidos (streak/médias). */
export const DAILY_RETENTION_DAYS = 180;
/** Aviso preventivo de quota: bytes serializados a partir dos quais a UI avisa. */
export const QUOTA_WARN_BYTES = 3_200_000;

export interface TypeStat {
  attempts: number;
  attemptedIds: number;
  bestScore: number | null;
  lastAttemptAt: number;
}

const KEY = "pte-master-hub";
/** Chaves antigas, lidas uma vez e migradas para KEY. */
const LEGACY_KEYS = ["readaloud-trainer-v1"];
/** Cópia bruta de estado ilegível (quarentena — nunca sobrescrito por mutações). */
const QUARANTINE_KEY = "pte-master-hub-quarantine";
/** Estado anterior guardado antes de um import (desfazer). */
export const UNDO_KEY = "pte-master-hub-undo";

export const DEFAULT_PLUS: PlusSettings = {
  wordTranslation: false,
  phraseTranslation: false,
  aiTranslation: true,
  plusAudio: false,
  vocabCapture: true,
};

export const DEFAULT_SETTINGS: Settings = {
  prepSeconds: 40,
  dailyGoal: 10,
  modelRate: 1,
  accent: "en-AU",
  examDate: null,
  targetScore: 65,
  lastBackupAt: null,
  micNoticeSeen: false,
  verifiedOnly: false, // D4 revisado: WFD/RS não têm fonte verificada — ligar por padrão as tiraria da fila
  plus: { ...DEFAULT_PLUS },
};

/** Normaliza os flags do pack: só `true` conta — qualquer outra coisa fica desligado.
 *  Exceção: `vocabCapture` e `aiTranslation` são LIGADOS por padrão (projetos 10 e 11) —
 *  só `false` explícito desliga, para que estados migrados (sem o campo) os mantenham. */
export function normalizePlusSettings(raw: unknown): PlusSettings {
  const p = (raw ?? {}) as Partial<PlusSettings>;
  return {
    wordTranslation: p.wordTranslation === true,
    phraseTranslation: p.phraseTranslation === true,
    aiTranslation: p.aiTranslation !== false,
    plusAudio: p.plusAudio === true,
    vocabCapture: p.vocabCapture !== false,
  };
}

export const ACCENT_OPTIONS: { value: Accent; label: string }[] = [
  { value: "en-AU", label: "Australiano (padrão PTE)" },
  { value: "en-US", label: "Americano" },
  { value: "en-GB", label: "Britânico" },
];

export function emptyState(preserveSettings?: Settings, preserveVocab?: VocabStore): AppState {
  return {
    version: STATE_VERSION,
    srsRules: 2,
    attempts: [],
    questions: {},
    daily: {},
    bookmarks: [],
    notes: {},
    sessions: [],
    draft: null,
    examDraft: null,
    vocabDraft: null,
    vocabulary: preserveVocab ? preserveVocab : emptyVocabStore(),
    settings: preserveSettings
      ? { ...preserveSettings, plus: { ...preserveSettings.plus } }
      : { ...DEFAULT_SETTINGS, plus: { ...DEFAULT_PLUS } },
  };
}

const EMPTY = emptyState();

// ---------- snapshots SRS (puros, testáveis) ----------

const DAY = 86_400_000;

/**
 * Aplica uma tentativa ao snapshot de uma questão (puro).
 * Fase 2 (decisões D11/D12 do PRD) — único ponto do código que define a
 * passagem de caixa:
 *  - Promoção: score ≥ passScoreFor(tipo) E a questão estava VENCIDA
 *    (`a.ts ≥ dueAt` anterior; caixa 0 tem dueAt 0 → sempre vencida).
 *    Prática antecipada registra score/contadores, NÃO promove e NÃO empurra
 *    a revisão.
 *  - Lapso: score < passScoreFor(tipo) rebaixa UMA caixa (piso 0) — não zera;
 *    `dueAt` volta ao intervalo da caixa nova.
 *  - `dueAt` = ts da tentativa qualificante + intervalo da caixa resultante.
 */
export function applyAttemptToSnapshot(
  snap: QuestionSnapshot | undefined,
  a: Attempt,
): QuestionSnapshot {
  const score = a.score ?? a.contentScore;
  const base: QuestionSnapshot = snap ?? {
    attempts: 0,
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
  };
  // Tentativa sem score não altera o snapshot (semântica v5 preservada).
  if (score === null) return base;
  const pass = score >= passScoreFor(a.taskType);
  const strong = score >= STRONG_SCORE;
  const wasDue = base.dueAt <= a.ts;
  const counters = {
    attempts: base.attempts + 1,
    bestScore: score > (base.bestScore ?? -1) ? score : base.bestScore,
    bestWpm:
      a.mode === "speech" && a.wpm !== null && a.wpm > (base.bestWpm ?? -1) ? a.wpm : base.bestWpm,
    lastScore: score,
    lastAttemptAt: Math.max(base.lastAttemptAt, a.ts),
    strongAttempts: base.strongAttempts + (strong ? 1 : 0),
    dueStrongAttempts: base.dueStrongAttempts + (strong && wasDue ? 1 : 0),
    prevStrong: base.attempts > 0 && (base.lastScore ?? 0) >= STRONG_SCORE,
    lastAttemptDue: wasDue,
  };
  if (!pass) {
    // Lapso: rebaixa uma caixa gradualmente; a revisão volta ao intervalo da caixa nova.
    const box = Math.max(base.box - 1, 0);
    return { ...base, ...counters, box, dueAt: a.ts + SRS_INTERVAL_DAYS[box]! * DAY };
  }
  if (!wasDue) {
    // Prática antecipada: registra e não promove; a revisão mantém o prazo original.
    return { ...base, ...counters, box: base.box, dueAt: base.dueAt };
  }
  const box = Math.min(base.box + 1, SRS_INTERVAL_DAYS.length - 1);
  return { ...base, ...counters, box, dueAt: a.ts + SRS_INTERVAL_DAYS[box]! * DAY };
}

function snapshotToStat(s: QuestionSnapshot): QuestionStat {
  return {
    attempts: s.attempts,
    bestContent: s.bestScore,
    bestWpm: s.bestWpm,
    lastAttemptAt: s.lastAttemptAt,
    lastScore: s.lastScore,
    strongAttempts: s.strongAttempts,
    dueStrongAttempts: s.dueStrongAttempts,
    prevStrong: s.prevStrong,
    lastAttemptDue: s.lastAttemptDue,
    box: s.box,
    dueAt: s.dueAt,
  };
}

/** Reconstrói os snapshots por replay cronológico de um log completo. */
function replaySnapshots(attempts: Attempt[]): Record<string, QuestionSnapshot> {
  const ordered = [...attempts].sort((x, y) => x.ts - y.ts);
  const questions: Record<string, QuestionSnapshot> = {};
  for (const a of ordered) {
    questions[a.qid] = applyAttemptToSnapshot(questions[a.qid], a);
  }
  return questions;
}

// ---------- quase-duplicatas (Fase 5, C3) ----------

const maxNullable = (a: number | null, b: number | null): number | null => {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
};

/**
 * Funde dois snapshots da mesma questão canônica — zero perda:
 * contadores somados, melhores = máximos, "última" = a tentativa mais recente,
 * caixa/prazo = máximos (a caixa mais avançada sobrevive). Mesma semântica da
 * mescla de backup (backup.ts).
 */
export function mergeSnapshots(a: QuestionSnapshot, b: QuestionSnapshot): QuestionSnapshot {
  const newer = b.lastAttemptAt >= a.lastAttemptAt ? b : a;
  return {
    attempts: a.attempts + b.attempts,
    bestScore: maxNullable(a.bestScore, b.bestScore),
    bestWpm: maxNullable(a.bestWpm, b.bestWpm),
    lastScore: newer.lastScore,
    lastAttemptAt: Math.max(a.lastAttemptAt, b.lastAttemptAt),
    strongAttempts: a.strongAttempts + b.strongAttempts,
    dueStrongAttempts: a.dueStrongAttempts + b.dueStrongAttempts,
    prevStrong: newer.prevStrong,
    lastAttemptDue: newer.lastAttemptDue,
    box: Math.max(a.box, b.box),
    dueAt: Math.max(a.dueAt, b.dueAt),
  };
}

/** Reindexa snapshots pelo id canônico, fundindo pares de quase-duplicatas (C3). */
export function canonicalizeQuestions(
  questions: Record<string, QuestionSnapshot>,
): Record<string, QuestionSnapshot> {
  const out: Record<string, QuestionSnapshot> = {};
  for (const [qid, snap] of Object.entries(questions)) {
    const cid = canonicalIdOf(qid);
    const cur = out[cid];
    out[cid] = cur ? mergeSnapshots(cur, snap) : snap;
  }
  return out;
}

/** Marcadores de livros sob ids canônicos, sem repetições. */
function canonicalBookmarks(bookmarks: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const b of bookmarks) {
    const cid = canonicalIdOf(b);
    if (!seen.has(cid)) {
      seen.add(cid);
      out.push(cid);
    }
  }
  return out;
}

/** Notas sob ids canônicos; em colisão vence a mais recente. */
function canonicalNotes(notes: Record<string, QuestionNote>): Record<string, QuestionNote> {
  const out: Record<string, QuestionNote> = {};
  for (const [qid, note] of Object.entries(notes)) {
    const cid = canonicalIdOf(qid);
    const cur = out[cid];
    if (!cur || note.updatedAt > cur.updatedAt) out[cid] = note;
  }
  return out;
}

/** Agregados diários a partir de um log completo. */
function buildDailyFromAttempts(attempts: Attempt[]): Record<string, DailyAggregate> {
  const daily: Record<string, DailyAggregate> = {};
  for (const a of attempts) {
    const k = dayKey(a.ts);
    const cur = daily[k] ?? { attempts: 0, scored: 0, sum: 0 };
    cur.attempts += 1;
    const score = a.score ?? a.contentScore;
    if (score !== null) {
      cur.scored += 1;
      cur.sum += score;
    }
    daily[k] = cur;
  }
  return daily;
}

/** Mantém só os últimos DAILY_RETENTION_DAYS dias (chamado ao gravar/migrar). */
function pruneDaily(daily: Record<string, DailyAggregate>): Record<string, DailyAggregate> {
  const keep = new Set(lastDayKeys(DAILY_RETENTION_DAYS));
  const out: Record<string, DailyAggregate> = {};
  for (const [k, v] of Object.entries(daily)) {
    if (keep.has(k)) out[k] = v;
  }
  return out;
}

// ---------- normalização ----------

/** Aceita "YYYY-MM-DD" que de fato existe no calendário (1970–2100). */
export function isValidExamDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function normalizeSettings(raw: unknown): Settings {
  const s = (raw ?? {}) as Partial<Settings>;
  const accent: Accent =
    s.accent === "en-US" || s.accent === "en-GB" || s.accent === "en-AU"
      ? s.accent
      : DEFAULT_SETTINGS.accent;
  const targetScore =
    typeof s.targetScore === "number" &&
    Number.isFinite(s.targetScore) &&
    s.targetScore >= 10 &&
    s.targetScore <= 90
      ? Math.round(s.targetScore)
      : DEFAULT_SETTINGS.targetScore;
  return {
    prepSeconds:
      typeof s.prepSeconds === "number" && s.prepSeconds >= 0
        ? s.prepSeconds
        : DEFAULT_SETTINGS.prepSeconds,
    dailyGoal:
      typeof s.dailyGoal === "number" && s.dailyGoal > 0 ? s.dailyGoal : DEFAULT_SETTINGS.dailyGoal,
    modelRate:
      typeof s.modelRate === "number" && s.modelRate > 0 ? s.modelRate : DEFAULT_SETTINGS.modelRate,
    accent,
    examDate: isValidExamDate(s.examDate) ? s.examDate : null,
    targetScore,
    lastBackupAt: typeof s.lastBackupAt === "number" ? s.lastBackupAt : null,
    micNoticeSeen: s.micNoticeSeen === true,
    verifiedOnly: s.verifiedOnly === true,
    plus: normalizePlusSettings(s.plus),
  };
}

function normalizeAttempt(raw: unknown): Attempt | null {
  const a = (raw ?? {}) as Partial<Attempt> & { qid?: unknown };
  if (typeof a.qid !== "string" || a.qid.length === 0) return null;
  const contentScore = typeof a.contentScore === "number" ? a.contentScore : null;
  const score = typeof a.score === "number" ? a.score : contentScore;
  return {
    qid: a.qid,
    ts: typeof a.ts === "number" ? a.ts : Date.now(),
    taskType: (a.taskType ?? "read_aloud") as TaskType,
    mode: a.mode === "manual" ? "manual" : "speech",
    contentScore,
    score,
    wpm: typeof a.wpm === "number" ? a.wpm : null,
    durationMs: typeof a.durationMs === "number" ? a.durationMs : 0,
    ...(a.metrics && typeof a.metrics === "object"
      ? { metrics: a.metrics as Record<string, number> }
      : {}),
    ...(Array.isArray(a.tags)
      ? { tags: a.tags.filter((t) => typeof t === "string" && t.length > 0).slice(0, 12) }
      : {}),
  };
}

// ---------- normalizadores v3 (sessões, draft, notas) ----------

const SESSION_KINDS: SessionKind[] = ["srs", "mixed", "errors", "due", "exam"];

function kindOf(raw: unknown): SessionKind {
  return SESSION_KINDS.includes(raw as SessionKind) ? (raw as SessionKind) : "srs";
}

function normalizeResults(raw: unknown): SessionResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const x = (r ?? {}) as Partial<SessionResult>;
      if (typeof x.qid !== "string" || x.qid.length === 0) return null;
      return {
        qid: x.qid,
        score: typeof x.score === "number" ? x.score : null,
        wpm: typeof x.wpm === "number" ? x.wpm : null,
      } satisfies SessionResult;
    })
    .filter((r): r is SessionResult => r !== null);
}

function normalizeSessions(raw: unknown): SessionRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r): SessionRecord | null => {
      const x = (r ?? {}) as Partial<SessionRecord>;
      if (typeof x.id !== "string" || x.id.length === 0) return null;
      const startedAt = typeof x.startedAt === "number" ? x.startedAt : 0;
      const finishedAt = typeof x.finishedAt === "number" ? x.finishedAt : startedAt;
      const results = normalizeResults(x.results);
      if (results.length === 0) return null; // sessão sem resultado não vale histórico
      return {
        id: x.id,
        startedAt,
        finishedAt,
        kind: kindOf(x.kind),
        label: typeof x.label === "string" ? x.label : "Sessão",
        results,
      };
    })
    .filter((r): r is SessionRecord => r !== null)
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, MAX_SESSIONS);
}

const EXAM_IDS: ExamId[] = ["speaking", "writing", "reading", "listening", "mini", "full"];

const EXAM_CAUSES: ExamResultCause[] = [
  "graded",
  "skipped",
  "expired",
  "technical",
  "empty",
  "not_gradable",
];

/** Resultados do draft de simulado: qid + score + causa + resposta (truncada). */
function normalizeExamResults(raw: unknown): ExamResultRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ExamResultRow[] = [];
  for (const r of raw) {
    const x = (r ?? {}) as Partial<ExamResultRow>;
    if (typeof x.qid !== "string" || x.qid.length === 0) continue;
    out.push({
      qid: x.qid,
      score: typeof x.score === "number" ? x.score : null,
      ...(x.cause !== undefined && EXAM_CAUSES.includes(x.cause) ? { cause: x.cause } : {}),
      ...(typeof x.answer === "string" && x.answer.trim()
        ? { answer: x.answer.trim().slice(0, 2000) }
        : {}),
    });
  }
  return out;
}

function normalizeExamDraft(raw: unknown): ExamDraft | null {
  const d = (raw ?? {}) as Partial<ExamDraft>;
  if (!EXAM_IDS.includes(d.examId as ExamId)) return null;
  if (!Array.isArray(d.queue)) return null;
  const queue = d.queue.filter((q): q is string => typeof q === "string" && q.length > 0);
  if (queue.length === 0) return null;
  const index =
    typeof d.index === "number" &&
    Number.isInteger(d.index) &&
    d.index >= 0 &&
    d.index < queue.length
      ? d.index
      : 0;
  return {
    examId: d.examId as ExamId,
    queue,
    index,
    results: normalizeExamResults(d.results),
    phase: d.phase === "summary" ? "summary" : "running",
    deadlineAt: typeof d.deadlineAt === "number" && d.deadlineAt > 0 ? d.deadlineAt : Date.now(),
    startedAt: typeof d.startedAt === "number" && d.startedAt > 0 ? d.startedAt : Date.now(),
  };
}

/** Draft leve da revisão de vocabulário (projeto 13, §4.3): fila por chaves,
 * placar e reagendadas — tudo validado; malformado vira null (sem retomada). */
function normalizeVocabDraft(raw: unknown): VocabReviewDraft | null {
  const d = (raw ?? {}) as Partial<VocabReviewDraft>;
  if (!Array.isArray(d.queue) || d.queue.length === 0) return null;
  const queue: { kind: VocabKind; key: string }[] = [];
  for (const c of d.queue) {
    const e = (c ?? {}) as Partial<{ kind: VocabKind; key: string }>;
    if ((e.kind === "word" || e.kind === "phrase") && typeof e.key === "string" && e.key) {
      queue.push({ kind: e.kind, key: e.key });
    }
  }
  if (queue.length === 0) return null;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  const index = Math.min(Math.max(0, num(d.index)), queue.length);
  return {
    startedAt: typeof d.startedAt === "number" && d.startedAt > 0 ? d.startedAt : Date.now(),
    queue,
    index,
    sim: num(d.sim),
    nao: num(d.nao),
    requeued: Array.isArray(d.requeued)
      ? d.requeued.filter((k): k is string => typeof k === "string" && k.length > 0)
      : [],
  };
}

function normalizeDraft(raw: unknown): SessionDraft | null {
  const d = (raw ?? {}) as Partial<SessionDraft>;
  if (!Array.isArray(d.queue) || d.queue.length === 0) return null;
  const queue = d.queue.filter((q): q is string => typeof q === "string" && q.length > 0);
  if (queue.length === 0) return null;
  const index =
    typeof d.index === "number" && d.index >= 0 && d.index <= queue.length
      ? Math.floor(d.index)
      : 0;
  return {
    kind: kindOf(d.kind),
    label: typeof d.label === "string" && d.label ? d.label : "Sessão",
    queue,
    index,
    startedAt: typeof d.startedAt === "number" ? d.startedAt : Date.now(),
    results: normalizeResults(d.results),
    skips: typeof d.skips === "number" && d.skips >= 0 ? Math.floor(d.skips) : 0,
  };
}

function normalizeNotes(raw: unknown): Record<string, QuestionNote> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, QuestionNote> = {};
  for (const [qid, note] of Object.entries(raw as Record<string, unknown>)) {
    const n = (note ?? {}) as Partial<QuestionNote>;
    if (typeof n.text !== "string" || !n.text.trim()) continue;
    out[qid] = {
      text: n.text.slice(0, 2000),
      updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : 0,
    };
  }
  return out;
}

function normalizeSnapshots(raw: unknown): Record<string, QuestionSnapshot> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, QuestionSnapshot> = {};
  for (const [qid, s] of Object.entries(raw as Record<string, unknown>)) {
    const x = (s ?? {}) as Partial<QuestionSnapshot>;
    if (typeof x.lastAttemptAt !== "number" || typeof x.box !== "number") continue;
    out[qid] = {
      attempts: typeof x.attempts === "number" && x.attempts > 0 ? x.attempts : 1,
      bestScore: typeof x.bestScore === "number" ? x.bestScore : null,
      bestWpm: typeof x.bestWpm === "number" ? x.bestWpm : null,
      lastScore: typeof x.lastScore === "number" ? x.lastScore : null,
      lastAttemptAt: x.lastAttemptAt,
      strongAttempts: typeof x.strongAttempts === "number" ? x.strongAttempts : 0,
      dueStrongAttempts: typeof x.dueStrongAttempts === "number" ? x.dueStrongAttempts : 0,
      prevStrong: x.prevStrong === true,
      lastAttemptDue: x.lastAttemptDue === true,
      box: Math.max(0, Math.min(SRS_INTERVAL_DAYS.length - 1, Math.round(x.box))),
      dueAt: typeof x.dueAt === "number" ? x.dueAt : x.lastAttemptAt,
    };
  }
  return out;
}

function normalizeDaily(raw: unknown): Record<string, DailyAggregate> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, DailyAggregate> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    const x = (v ?? {}) as Partial<DailyAggregate>;
    const attempts = typeof x.attempts === "number" && x.attempts > 0 ? x.attempts : 0;
    if (attempts === 0) continue;
    const scored = typeof x.scored === "number" && x.scored >= 0 ? x.scored : 0;
    out[k] = {
      attempts,
      scored: Math.min(scored, attempts),
      sum: typeof x.sum === "number" && x.sum >= 0 ? x.sum : 0,
    };
  }
  return out;
}

/**
 * Fase 2 (B5): recalcula caixa/dueAt de snapshots gerados com as regras antigas
 * pelo replay cronológico do log, aplicando as regras novas — sem perder
 * tentativas (a contagem vem do replay quando o log cobre o snapshot inteiro).
 * - Log cobre o snapshot (rep.attempts ≥ snap.attempts) → snapshot recalculado.
 * - Log truncado abaixo do snapshot → mantém caixa/prazo antigos (nada é
 *   inventado) e adota os contadores de due-gating do replay (conservador).
 */
function recalcSrsSnapshots(app: AppState): AppState {
  // Replay sob ids canônicos: pares de quase-duplicatas viram UMA série (C3).
  const replayed = canonicalizeQuestions(replaySnapshots(app.attempts));
  const questions: Record<string, QuestionSnapshot> = {};
  for (const [qid, snap] of Object.entries(app.questions)) {
    const rep = replayed[qid];
    if (rep && rep.attempts >= snap.attempts) {
      questions[qid] = rep;
    } else if (rep) {
      questions[qid] = {
        ...snap,
        dueStrongAttempts: rep.dueStrongAttempts,
        prevStrong: rep.prevStrong,
        lastAttemptDue: rep.lastAttemptDue,
      };
    } else {
      questions[qid] = {
        ...snap,
        dueStrongAttempts: 0,
        prevStrong: false,
        lastAttemptDue: false,
      };
    }
  }
  for (const [qid, rep] of Object.entries(replayed)) {
    if (!questions[qid]) questions[qid] = rep;
  }
  return { ...app, questions, srsRules: 2 };
}

/**
 * Migração pura (testável): aceita estado v1 (Read Aloud), v2, v3, v4, v5 ou v6
 * e devolve AppState v6. Nos legados, o snapshot é semeado pelo log COMPLETO
 * antes de qualquer corte do log. Snapshots v6 sem `srsRules: 2` foram gerados
 * com as regras antigas → recalculados pelas regras novas (Fase 2).
 */
export function migrateLegacyState(parsed: unknown): AppState {
  const obj = (parsed ?? {}) as Record<string, unknown> & { version?: number };
  const v = obj.version;
  if (v !== 1 && v !== 2 && v !== 3 && v !== 4 && v !== 5 && v !== 6 && v !== 7)
    return emptyState();
  const settings = normalizeSettings(obj["settings"]);
  const attempts = (Array.isArray(obj["attempts"]) ? obj["attempts"] : [])
    .map((a) => normalizeAttempt(a))
    .filter((a): a is Attempt => a !== null);
  const bookmarks = canonicalBookmarks(
    (Array.isArray(obj["bookmarks"]) ? obj["bookmarks"] : []).filter((b) => typeof b === "string"),
  );
  const notes = canonicalNotes(normalizeNotes(obj["notes"]));
  const sessions = normalizeSessions(obj["sessions"]);
  const draft =
    (v === 3 || v === 4 || v === 5 || v === 6 || v === 7) && obj["draft"] !== undefined
      ? normalizeDraft(obj["draft"])
      : null;

  if (v === 6 || v === 7) {
    const base: AppState = {
      version: 7,
      srsRules: 2,
      attempts,
      questions: canonicalizeQuestions(normalizeSnapshots(obj["questions"])),
      daily: pruneDaily(normalizeDaily(obj["daily"])),
      bookmarks,
      notes,
      sessions,
      draft,
      examDraft: normalizeExamDraft(obj["examDraft"]),
      vocabDraft: normalizeVocabDraft(obj["vocabDraft"]),
      vocabulary: normalizeVocabStore(obj["vocabulary"]),
      settings,
    };
    return obj["srsRules"] === 2 ? base : recalcSrsSnapshots(base);
  }

  // Legado (v1–v6): semeia snapshot e agregados ANTES de cortar o log.
  const questions = canonicalizeQuestions(replaySnapshots(attempts));
  const daily = pruneDaily(buildDailyFromAttempts(attempts));
  return {
    version: 7,
    srsRules: 2,
    attempts: [...attempts].sort((x, y) => x.ts - y.ts).slice(-MAX_ATTEMPTS),
    questions,
    daily,
    bookmarks,
    notes,
    sessions,
    draft,
    examDraft: normalizeExamDraft(obj["examDraft"]),
    vocabDraft: normalizeVocabDraft(obj["vocabDraft"]),
    vocabulary: normalizeVocabStore(obj["vocabulary"]),
    settings,
  };
}

// ---------- leitura resiliente (quarentena / versão futura) ----------

export type StorageStatus = "ok" | "quarantined" | "future";

function readKey(key: string): AppState | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  return migrateLegacyState(JSON.parse(raw) as unknown);
}

function loadState(): { state: AppState; status: StorageStatus } {
  if (typeof window === "undefined") return { state: EMPTY, status: "ok" };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Ilegível: quarentena (cópia bruta) + estado limpo — o original NÃO é sobrescrito.
        try {
          window.localStorage.setItem(QUARANTINE_KEY, raw);
        } catch {
          /* quota cheia — a quarentena é best-effort */
        }
        console.warn("Progresso ilegível — cópia guardada em quarentena; iniciando limpo.");
        return { state: emptyState(), status: "quarantined" };
      }
      const version = (parsed as { version?: unknown })?.version;
      if (typeof version === "number" && version > STATE_VERSION) {
        // Versão futura: NUNCA sobrescrever — modo somente-leitura.
        console.warn(
          `Estado do futuro (versão ${version}) — progresso preservado; modo somente-leitura.`,
        );
        return { state: emptyState(), status: "future" };
      }
      const migrated = migrateLegacyState(parsed);
      return { state: migrated, status: "ok" };
    }
    for (const legacy of LEGACY_KEYS) {
      const oldRaw = window.localStorage.getItem(legacy);
      if (oldRaw !== null) {
        let migrated: AppState;
        try {
          migrated = migrateLegacyState(JSON.parse(oldRaw) as unknown);
        } catch {
          continue;
        }
        // migra para a chave nova e só então apaga a antiga
        window.localStorage.setItem(KEY, JSON.stringify(migrated));
        window.localStorage.removeItem(legacy);
        return { state: migrated, status: "ok" };
      }
    }
    return { state: emptyState(), status: "ok" };
  } catch (err) {
    console.warn("Progresso ilegível — iniciando com estado limpo.", err);
    return { state: emptyState(), status: "ok" };
  }
}

let state: AppState;
/** Versão futura: mutações acontecem só em memória; o payload original fica intacto. */
let readOnly = false;

const boot = loadState();
state = boot.state;
const storageStatus: StorageStatus = boot.status;
readOnly = boot.status === "future";

const listeners = new Set<() => void>();
const statusListeners = new Set<() => void>();

// ---------- saúde da persistência (quota cheia / modo privado) ----------
let persistFailed = false;
let quotaPressure = false;
const persistListeners = new Set<() => void>();
const healthListeners = new Set<() => void>();

function emitHealth() {
  healthListeners.forEach((l) => l());
}

function setPersistFailed(v: boolean) {
  if (persistFailed === v) return;
  persistFailed = v;
  persistListeners.forEach((l) => l());
}

/** true quando o último salvamento falhou (progresso só em memória até recarregar). */
export function usePersistFailed(): boolean {
  return useSyncExternalStore(
    (l) => {
      persistListeners.add(l);
      return () => persistListeners.delete(l);
    },
    () => persistFailed,
    () => false,
  );
}

/** Aviso PREVENTIVO de quota: payload ≥ QUOTA_WARN_BYTES. */
export function useQuotaPressure(): boolean {
  return useSyncExternalStore(
    (l) => {
      healthListeners.add(l);
      return () => healthListeners.delete(l);
    },
    () => quotaPressure,
    () => false,
  );
}

/** Estado da leitura inicial: "ok", "quarantined" (ilegível guardado) ou "future". */
/** Estado da leitura inicial: "ok", "quarantined" (ilegível guardado) ou "future". */
export function getStorageStatus(): StorageStatus {
  return storageStatus;
}

export function useStorageStatus(): StorageStatus {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => storageStatus,
    () => "ok" as StorageStatus,
  );
}

/** navigator.storage.persist() — pedido único, best-effort (evita limpeza automática). */
let persistRequested = false;
function requestPersistentStorage() {
  if (persistRequested || typeof navigator === "undefined") return;
  persistRequested = true;
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* navegador sem a API */
  }
}

// ---------- escrita coalescida ----------

let writeScheduled = false;

function doWrite() {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify(state);
    window.localStorage.setItem(KEY, payload);
    setPersistFailed(false);
    const pressure = payload.length >= QUOTA_WARN_BYTES;
    if (pressure !== quotaPressure) {
      quotaPressure = pressure;
      emitHealth();
    }
  } catch {
    setPersistFailed(true);
  }
}

function persist() {
  if (readOnly || typeof window === "undefined") return;
  if (writeScheduled) return;
  writeScheduled = true;
  queueMicrotask(() => {
    writeScheduled = false;
    doWrite();
  });
}

/** Força a gravação pendente (usado antes de exportar/descarregar a página). */
export function flushPendingWrite() {
  if (writeScheduled) {
    writeScheduled = false;
    doWrite();
  }
}

if (typeof window !== "undefined") {
  const flush = () => flushPendingWrite();
  window.addEventListener("pagehide", flush);
  window.addEventListener("visibilitychange", flush);
}

// ---------- sincronização entre abas ----------

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try {
      if (e.newValue === null) {
        state = emptyState();
      } else {
        state = migrateLegacyState(JSON.parse(e.newValue) as unknown);
      }
      listeners.forEach((l) => l());
    } catch {
      /* conteúdo ilegível vindo de outra aba: ignora */
    }
  });
}

function setState(next: AppState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

/** Leitura pura do estado atual (para lógica não-React, ex.: backup.ts). */
export function getStateSnapshot(): AppState {
  return state;
}

/** Substitui o estado inteiro (usado por import/undo em `src/lib/backup.ts`). */
export function replaceState(next: AppState) {
  setState(next);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function recordAttempt(
  attempt: Omit<Partial<Attempt>, "ts"> & { qid: string; ts?: number },
) {
  const { metrics, tags, ...rest } = attempt;
  const entry: Attempt = {
    ts: attempt.ts ?? Date.now(),
    ...rest,
    ...(metrics ? { metrics } : {}),
    ...(tags && tags.length > 0 ? { tags: tags.slice(0, 12) } : {}),
    taskType: attempt.taskType ?? "read_aloud",
    mode: attempt.mode ?? "manual",
    contentScore: attempt.contentScore ?? null,
    score: attempt.score ?? attempt.contentScore ?? null,
    wpm: attempt.wpm ?? null,
    durationMs: attempt.durationMs ?? 0,
  };
  // 1) Snapshot por questão (fonte de verdade — nunca derivado do log).
  // Fase 5 (C3): a tentativa é contabilizada no id canônico da questão.
  const cid = canonicalIdOf(entry.qid);
  const questions = {
    ...state.questions,
    [cid]: applyAttemptToSnapshot(state.questions[cid], entry),
  };
  // 2) Agregado diário.
  const day = dayKey(entry.ts);
  const agg = state.daily[day] ?? { attempts: 0, scored: 0, sum: 0 };
  const score = entry.score ?? entry.contentScore;
  const daily = {
    ...state.daily,
    [day]: {
      attempts: agg.attempts + 1,
      scored: agg.scored + (score !== null ? 1 : 0),
      sum: agg.sum + (score ?? 0),
    },
  };
  // 3) Log truncável (só auditoria) + persistência.
  setState({
    ...state,
    attempts: [...state.attempts, entry].slice(-MAX_ATTEMPTS),
    questions,
    daily: pruneDaily(daily),
  });
  requestPersistentStorage();
}

export function toggleBookmark(qid: string) {
  const cid = canonicalIdOf(qid);
  const has = state.bookmarks.includes(cid);
  setState({
    ...state,
    bookmarks: has ? state.bookmarks.filter((id) => id !== cid) : [...state.bookmarks, cid],
  });
}

export function updateSettings(patch: Partial<Settings>) {
  setState({ ...state, settings: { ...state.settings, ...patch } });
}

// ---------- sessões: histórico, draft retomável e notas ----------

/** Sessão em andamento (draft) do estado atual — leitura pura, sem hook. */
export function getSessionDraft(): SessionDraft | null {
  return state.draft;
}

/** Grava/atualiza o draft da sessão em andamento (retomável após reload). */
export function saveSessionDraft(draft: SessionDraft) {
  setState({ ...state, draft: normalizeDraft(draft) });
}

/** Limpa o draft (sessão encerrada ou descartada). */
export function clearSessionDraft() {
  if (state.draft === null) return;
  setState({ ...state, draft: null });
}

// ---------- simulado: draft retomável (projeto 13, D5) ----------

/** Simulado em andamento — leitura pura, sem hook. */
export function getExamDraft(): ExamDraft | null {
  return state.examDraft ?? null;
}

/** Grava/atualiza o draft do simulado (retomável após reload). */
export function saveExamDraft(draft: ExamDraft) {
  setState({ ...state, examDraft: normalizeExamDraft(draft) });
}

/** Limpa o draft do simulado (concluído, descartado ou arquivado). */
export function clearExamDraft() {
  if (!state.examDraft) return;
  setState({ ...state, examDraft: null });
}

// ---------- vocabulário: draft leve da revisão (projeto 13, §4.3) ----------

/** Revisão de vocabulário em andamento — leitura pura, sem hook. */
export function getVocabDraft(): VocabReviewDraft | null {
  return state.vocabDraft ?? null;
}

/** Grava/atualiza o draft da revisão de vocabulário (retomável após reload). */
export function saveVocabDraft(draft: VocabReviewDraft) {
  setState({ ...state, vocabDraft: normalizeVocabDraft(draft) });
}

/** Limpa o draft (revisão concluída ou encerrada). */
export function clearVocabDraft() {
  if (!state.vocabDraft) return;
  setState({ ...state, vocabDraft: null });
}

/** Arquiva uma sessão no histórico (mais recente primeiro, teto MAX_SESSIONS). */
export function addSessionRecord(record: Omit<SessionRecord, "id"> & { id?: string }) {
  const entry: SessionRecord = {
    id: record.id ?? `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    kind: kindOf(record.kind),
    label: record.label,
    results: normalizeResults(record.results),
  };
  if (entry.results.length === 0) return;
  setState({
    ...state,
    sessions: [entry, ...state.sessions].slice(0, MAX_SESSIONS),
  });
}

/** Cria/atualiza a nota de uma questão; texto vazio apaga a nota. */
export function upsertNote(qid: string, text: string) {
  const cid = canonicalIdOf(qid);
  const clean = text.trim().slice(0, 2000);
  const next = { ...state.notes };
  if (!clean) {
    if (cid in next) {
      delete next[cid];
      setState({ ...state, notes: next });
    }
    return;
  }
  next[cid] = { text: clean, updatedAt: Date.now() };
  setState({ ...state, notes: next });
}

/** Zera histórico e favoritos, mas preserva os ajustes e o VOCABULÁRIO do usuário
 *  (D10: vocabulário é material de estudo acumulado, não histórico de treino;
 *  limpeza dedicada em Ajustes). */
export function resetProgress() {
  setState(emptyState(state.settings, state.vocabulary));
}

// ---------- vocabulário (projeto 10) ----------

/** Registra o gesto de tradução de uma palavra (mescla fontes, reconta gesto). */
export function saveVocabWord(input: SaveVocabWordInput) {
  setState({ ...state, vocabulary: saveVocabWordPure(state.vocabulary, input) });
}

/** Registra o gesto de tradução de uma frase. */
export function saveVocabPhrase(input: SaveVocabPhraseInput) {
  setState({ ...state, vocabulary: saveVocabPhrasePure(state.vocabulary, input) });
}

/** Remove um item do vocabulário (chave desconhecida → estado inalterado). */
export function removeVocabItem(kind: VocabKind, key: string) {
  setState({ ...state, vocabulary: removeVocabItemPure(state.vocabulary, kind, key) });
}

/** Apaga TODO o vocabulário — só o vocabulário (projeto 10, Fase 5). */
export function clearVocabAll() {
  setState({ ...state, vocabulary: clearVocabAllPure(state.vocabulary) });
}

/** Liga/desliga o favorito de um item do vocabulário. */
export function toggleVocabStar(kind: VocabKind, key: string) {
  setState({ ...state, vocabulary: toggleVocabStarPure(state.vocabulary, kind, key) });
}

/** Aplica a auto-avaliação de estudo (caixa Leitner própria do vocabulário). */
export function applyVocabStudy(kind: VocabKind, key: string, remembered: boolean, ts: number) {
  setState({
    ...state,
    vocabulary: applyVocabStudyPure(state.vocabulary, kind, key, remembered, ts),
  });
  requestPersistentStorage();
}

// ---------- backup (export/import JSON) ----------

export function exportBackup(): string {
  flushPendingWrite();
  return JSON.stringify(
    {
      app: "pte-master-hub",
      version: STATE_VERSION,
      exportedAt: new Date().toISOString(),
      attempts: state.attempts,
      questions: state.questions,
      daily: state.daily,
      bookmarks: state.bookmarks,
      notes: state.notes,
      sessions: state.sessions,
      vocabulary: state.vocabulary,
      settings: state.settings,
    },
    null,
    2,
  );
}

const BACKUP_VERSIONS = [2, 3, 4, 5, 6, 7];

export function importBackup(json: string): { ok: boolean; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "o arquivo não é um JSON válido" };
  }
  const obj = parsed as Record<string, unknown>;
  const version = obj["version"];
  const isCurrent = obj["app"] === "pte-master-hub" && BACKUP_VERSIONS.includes(version as number);
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
  // Undo: guarda o estado atual antes de substituir (recuperável em backup.ts).
  try {
    flushPendingWrite();
    window.localStorage.setItem(UNDO_KEY, JSON.stringify(state));
  } catch {
    /* sem espaço para o undo — o import segue (o usuário foi avisado do risco) */
  }
  const migrated = migrateLegacyState(parsed);
  setState({
    ...migrated,
    settings: { ...migrated.settings, lastBackupAt: Date.now() },
  });
  return { ok: true };
}

// ---------- derivados (puros, testáveis) ----------

function scoreOf(a: Attempt): number | null {
  return a.score ?? a.contentScore;
}

/**
 * Estatística por questão. Fonte: snapshot `questions`; tentativas do log mais
 * novas que o snapshot (ou qids ausentes — estados sintéticos/legados) são
 * aplicadas por cima. O corte do log NÃO afeta o resultado (A1).
 */
export function computeStats(app: AppState): Map<string, QuestionStat> {
  const map = new Map<string, QuestionStat>();
  // Fase 5 (C3): estatísticas sob o id canônico — pares de quase-duplicatas
  // somam no mesmo lugar (nada se divide entre dois qids).
  const questions = canonicalizeQuestions(app.questions ?? {});
  for (const [qid, snap] of Object.entries(questions)) {
    map.set(qid, snapshotToStat(snap));
  }
  const ordered = [...app.attempts].sort((x, y) => x.ts - y.ts);
  // Replay só do que o snapshot não cobre (testes sintéticos / import legado).
  const covered = new Set(map.keys());
  const pending = new Map<string, Attempt[]>();
  for (const a of ordered) {
    if (scoreOf(a) === null) continue;
    const cid = canonicalIdOf(a.qid);
    const snap = questions[cid];
    if (snap && a.ts <= snap.lastAttemptAt) continue; // já contabilizada
    const list = pending.get(cid) ?? [];
    list.push(a);
    pending.set(cid, list);
  }
  for (const [qid, list] of pending) {
    const snap = covered.has(qid) ? questions[qid] : undefined;
    let cur = snap
      ? { ...snap }
      : {
          attempts: 0,
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
        };
    for (const a of list) cur = applyAttemptToSnapshot(cur, a);
    map.set(qid, snapshotToStat(cur));
  }
  return map;
}

/** Agregados por task type (para o dashboard por seção). */
export function computeTypeStats(app: AppState): Map<TaskType, TypeStat> {
  const map = new Map<TaskType, TypeStat>();
  const seenByType = new Map<TaskType, Set<string>>();
  for (const a of app.attempts) {
    const score = scoreOf(a);
    if (score === null) continue;
    const cur = map.get(a.taskType) ?? {
      attempts: 0,
      attemptedIds: 0,
      bestScore: null,
      lastAttemptAt: 0,
    };
    const seen = seenByType.get(a.taskType) ?? new Set<string>();
    // Fase 5 (C3): a mesma questão canônica tentada sob qids duplicados conta uma vez.
    const cid = canonicalIdOf(a.qid);
    const isNew = !seen.has(cid);
    seen.add(cid);
    cur.attempts += 1;
    if (isNew) cur.attemptedIds += 1;
    cur.lastAttemptAt = Math.max(cur.lastAttemptAt, a.ts);
    if (cur.bestScore === null || score > cur.bestScore) cur.bestScore = score;
    map.set(a.taskType, cur);
    seenByType.set(a.taskType, seen);
  }
  return map;
}

/**
 * "Dominada" (Fase 2) — critérios por tipo com gate anti-maratona:
 *  - Gate: exige ≥ 2 tentativas fortes feitas COM a questão VENCIDA, OU as
 *    duas últimas tentativas fortes com a ÚLTIMA feita vencida (a prática
 *    antecipada logo após uma revisão vencida conta como domínio atual;
 *    maratona de 5 minutos não domina — a 1ª forte vence, as demais não).
 *  - Read Aloud: melhor score ≥ 90 com ritmo de 120–160 ppm (critério original);
 *  - demais tipos: ≥ 2 tentativas fortes (≥ 90) e a última também forte.
 */
export function isMasteredStat(stat: QuestionStat | undefined, taskType?: TaskType): boolean {
  if (!stat) return false;
  const lastStrong = (stat.lastScore ?? 0) >= STRONG_SCORE;
  const lastTwoStrong = lastStrong && stat.prevStrong === true;
  const lastTwoDue = lastTwoStrong && stat.lastAttemptDue === true;
  const gate = (stat.dueStrongAttempts ?? 0) >= 2 || lastTwoDue;
  if (!gate) return false;
  if (taskType === undefined || taskType === "read_aloud") {
    return (
      (stat.bestContent ?? 0) >= STRONG_SCORE &&
      (stat.bestWpm ?? 0) >= 120 &&
      (stat.bestWpm ?? 0) <= 160
    );
  }
  return stat.strongAttempts >= 2 && lastStrong;
}

export { dayKey };

/** Dias consecutivos com ao menos uma tentativa, a partir de hoje (ou ontem). */
export function computeStreak(app: AppState): number {
  let days = new Set(
    Object.entries(app.daily ?? {})
      .filter(([, v]) => v.attempts > 0)
      .map(([k]) => k),
  );
  // Estados sintéticos (testes) podem ter só o log: deriva do log.
  if (days.size === 0 && app.attempts.length > 0) {
    days = new Set(app.attempts.map((a) => dayKey(a.ts)));
  }
  if (days.size === 0) return 0;
  const today = dayKey(Date.now());
  let cursor = days.has(today) ? today : shiftDayKey(today, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

export function attemptedToday(app: AppState): number {
  const today = dayKey(Date.now());
  const seen = new Set(app.attempts.filter((a) => dayKey(a.ts) === today).map((a) => a.qid));
  return seen.size;
}

/** Score médio das tentativas dos últimos `days` dias (null se nenhuma). */
export function recentAverage(app: AppState, days: number): number | null {
  const since = Date.now() - days * 86_400_000;
  const scores = app.attempts.filter((a) => scoreOf(a) !== null && a.ts >= since);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, a) => sum + (scoreOf(a) ?? 0), 0) / scores.length);
}

export function averageWpm(app: AppState): number | null {
  const wpms = app.attempts.filter((a) => a.wpm !== null && a.wpm > 0);
  if (wpms.length === 0) return null;
  return Math.round(wpms.reduce((sum, a) => sum + (a.wpm ?? 0), 0) / wpms.length);
}

/** Score médio por dia (últimos `days` dias), para o gráfico — calendário local. */
export function dailyAverages(
  app: AppState,
  days: number,
): { day: string; score: number | null }[] {
  const hasDaily = Object.keys(app.daily ?? {}).length > 0;
  const out: { day: string; score: number | null }[] = [];
  for (const key of lastDayKeys(days)) {
    if (hasDaily) {
      const agg = app.daily[key];
      out.push({
        day: key,
        score: agg && agg.scored > 0 ? Math.round(agg.sum / agg.scored) : null,
      });
      continue;
    }
    // Fallback sintético (sem agregados): deriva do log, por chave de dia.
    const scores = app.attempts.filter((a) => dayKey(a.ts) === key && scoreOf(a) !== null);
    out.push({
      day: key,
      score: scores.length
        ? Math.round(scores.reduce((s, a) => s + (scoreOf(a) ?? 0), 0) / scores.length)
        : null,
    });
  }
  return out;
}
