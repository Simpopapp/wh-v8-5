/**
 * Vocabulário do pack "studie-plus" (projeto 10) — funções puras, sem I/O.
 *
 * Guarda tudo que o aluno JÁ traduziu (sinal deliberado: tradução só abre por
 * tap explícito) com o contexto da questão de origem, para estudo posterior
 * em um único local. Nada é inventado: só entra item com tradução de fato
 * exibida pelo pack (palavra com hit no glossário; frase com tradução).
 *
 * Regras centrais (PRD projeto 10, D2–D8):
 *  - Re-salvar um item NÃO duplica: atualiza lastSeenAt/seenCount e mescla
 *    fontes (cap MAX_VOCAB_SOURCES), sem mexer na caixa de estudo.
 *  - A caixa Leitner do vocabulário é INDEPENDENTE do SRS de questões.
 *  - Teto MAX_VOCAB_ITEMS poda os itens com lastSeenAt mais antigo.
 */

import { TYPE_META, type Section } from "@/lib/pte";

/** Task type → seção do manifesto (usada por lista, sessão e teste do vocabulário). */
export function sectionOfType(type: string): Section | undefined {
  const meta = (TYPE_META as Record<string, { section?: Section } | undefined>)[type];
  return meta?.section;
}

/** Fonte do item: de qual questão veio o gesto de tradução. */
export interface VocabSource {
  /** Task type da questão (id interno, ex.: "read_aloud"). */
  type: string;
  /** Id da questão no catálogo. */
  qid: string;
}

/** Sentido acumulado (projeto 13, §4.3): par exibido anteriormente quando uma
 * re-tradução trouxe outra tradução — nada sobrescreve silenciosamente. */
export interface VocabSense {
  literal: string;
  contextual?: string;
  engine?: "glossary" | "ai";
  /** Momento em que este sentido foi visto (ms). */
  ts: number;
}

/** Palavra salva (EN → pt-BR, do glossário do pack). */
export interface VocabWord {
  /** Palavra minúscula sem pontuação (mesma chave do glossário). */
  word: string;
  /** Tradução literal exibida no balão. */
  literal: string;
  /** Nota contextual exibida no balão (opcional). */
  contextual?: string;
  savedAt: number;
  /** Última vez que o gesto de tradução ocorreu (recontagem). */
  lastSeenAt: number;
  /** Quantas vezes o aluno traduziu esta palavra. */
  seenCount: number;
  /** Até MAX_VOCAB_SOURCES fontes mais recentes (dedupe por type+qid). */
  sources: VocabSource[];
  /** Caixa Leitner própria do vocabulário (0–5) — estudo auto-avaliado. */
  box: number;
  /** Quando o item volta a ficar "para revisar" (ms). 0 = vencido. */
  dueAt: number;
  /** Favorito do aluno (destaca na lista e no estudo). */
  starred?: boolean;
  /** Mecanismo da ÚLTIMA tradução exibida (projeto 11): "glossary" estático ou "ai". */
  engine?: "glossary" | "ai";
  /** Sentidos anteriores (projeto 13, §4.3) — o mais recente por último. */
  senses?: VocabSense[];
}

/** Frase salva (EN → pt-BR, do phrases do pack). */
export interface VocabPhrase {
  /** Task type da questão de origem. */
  type: string;
  /** Id da questão de origem. */
  qid: string;
  /** Índice da frase no texto (alinhamento do extractor). */
  index: number;
  /** Texto original em inglês (a frase exibida). */
  en: string;
  /** Tradução literal exibida ao expandir. */
  literal: string;
  /** Tradução interpretativa exibida ao expandir (opcional). */
  contextual?: string;
  savedAt: number;
  lastSeenAt: number;
  seenCount: number;
  box: number;
  dueAt: number;
  starred?: boolean;
  /** Mecanismo da ÚLTIMA tradução exibida (projeto 11): "glossary" estático ou "ai". */
  engine?: "glossary" | "ai";
}

export interface VocabStore {
  /** Chave = palavra minúscula sem pontuação (vocabWordKey). */
  words: Record<string, VocabWord>;
  /** Chave = `${type}:${qid}#${index}` (vocabPhraseKey). */
  phrases: Record<string, VocabPhrase>;
}

/** Teto global do vocabulário (palavras + frases somadas) — poda por lastSeenAt. */
export const MAX_VOCAB_ITEMS = 4000;
/** Teto de fontes por item (as mais recentes por gesto). */
export const MAX_VOCAB_SOURCES = 6;
/** Teto de nota contextual (espelho do glossário/phrases — protege a quota). */
export const MAX_VOCAB_CONTEXTUAL = 200;
/** Teto de sentidos acumulados por palavra (projeto 13, §4.3) — os mais recentes. */
export const MAX_VOCAB_SENSES = 6;
/** Teto do texto EN da frase (frases longas truncam na captura, não no render). */
export const MAX_VOCAB_PHRASE_EN = 400;

/**
 * Intervalo (dias) de revisão do vocabulário por caixa Leitner — espelho de
 * `SRS_INTERVAL_DAYS` (src/lib/storage.ts). Definido aqui para evitar ciclo
 * vocab ↔ storage; o teste de fundação assegura que os dois continuam iguais.
 */
export const VOCAB_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;

const DAY_MS = 86_400_000;

/** Vocabulário vazio (mesma forma usada pelo emptyState do storage). */
export function emptyVocabStore(): VocabStore {
  return { words: {}, phrases: {} };
}

/**
 * Chave de palavra: MESMA normalização do lookup do glossário
 * (`lookupWord`, src/lib/plus/glossary.ts) — minúsculas, sem pontuação
 * externa, apóstrofo tipográfico unificado. Garante que "Rigorous," e
 * "rigorous" caiam no mesmo item.
 */
export function vocabWordKey(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[\W_]+|[\W_]+$/g, "")
    .replace(/[\u2019]/g, "'");
}

/** Chave de frase: dedupe natural por (type, qid, índice). */
export function vocabPhraseKey(type: string, qid: string, index: number): string {
  return `${type}:${qid}#${index}`;
}

export type VocabKind = "word" | "phrase";

/** Chave composta usada pelas ações de lista/estudo. */
export function vocabItemKey(kind: VocabKind, item: VocabWord | VocabPhrase): string {
  return kind === "word"
    ? vocabWordKey((item as VocabWord).word)
    : vocabPhraseKey(
        (item as VocabPhrase).type,
        (item as VocabPhrase).qid,
        (item as VocabPhrase).index,
      );
}

// ---------- captura ----------

export interface SaveVocabWordInput {
  /** Palavra como exibida (a normalização fica por conta da chave). */
  word: string;
  /** Tradução literal exibida no balão (obrigatória — nada é inventado). */
  literal: string;
  /** Nota contextual exibida (opcional). */
  contextual?: string;
  /** Questão de origem do gesto (opcional — palavra traduzida fora de questão). */
  source?: VocabSource;
  /** Mecanismo da tradução exibida (projeto 11, D7). */
  engine?: "glossary" | "ai";
  /** Momento do gesto (ms). */
  ts: number;
}

/** Mescla a fonte nova nas fontes existentes (dedupe por type+qid; cap; novas no fim). */
function mergeSources(existing: VocabSource[], incoming: VocabSource | undefined): VocabSource[] {
  if (!incoming || !incoming.type || !incoming.qid) return existing;
  const rest = existing.filter((s) => !(s.type === incoming.type && s.qid === incoming.qid));
  return [...rest, incoming].slice(-MAX_VOCAB_SOURCES);
}

/**
 * Registra o gesto de tradução de uma palavra. Item novo → caixa 0 (vencido,
 * entra no "revisar hoje"). Item existente → atualiza tradução/nota com o que
 * foi exibido agora, reconta o gesto e mescla a fonte; caixa intacta (D7).
 * Entrada inválida (word/literal vazios) devolve o store inalterado.
 */
export function saveVocabWord(store: VocabStore, input: SaveVocabWordInput): VocabStore {
  const key = vocabWordKey(input.word);
  const literal = typeof input.literal === "string" ? input.literal.trim() : "";
  if (!key || !literal) return store;
  const cur = store.words[key];
  const contextual =
    typeof input.contextual === "string" && input.contextual.trim() !== ""
      ? input.contextual.trim().slice(0, MAX_VOCAB_CONTEXTUAL)
      : undefined;
  const engine = input.engine === "ai" || input.engine === "glossary" ? input.engine : undefined;
  if (cur) {
    // Projeto 13 (§4.3): tradução DIFERENTE não sobrescreve sentidos — o par
    // exibido anteriormente vira um "sentido" acumulado (cap MAX_VOCAB_SENSES).
    const changed = cur.literal !== literal || (cur.contextual ?? undefined) !== contextual;
    const prior: VocabSense = {
      literal: cur.literal,
      ...(cur.contextual !== undefined ? { contextual: cur.contextual } : {}),
      ...(cur.engine !== undefined ? { engine: cur.engine } : {}),
      ts: cur.lastSeenAt,
    };
    const senses = changed
      ? [...(cur.senses ?? []), prior]
          .filter(
            (s, i, arr) =>
              arr.findIndex(
                (o) =>
                  o.literal === s.literal &&
                  (o.contextual ?? undefined) === (s.contextual ?? undefined),
              ) === i,
          )
          .slice(-MAX_VOCAB_SENSES)
      : cur.senses;
    return {
      ...store,
      words: {
        ...store.words,
        [key]: {
          ...cur,
          literal,
          ...(contextual !== undefined ? { contextual } : {}),
          ...(engine !== undefined ? { engine } : {}),
          ...(senses && senses.length > 0 ? { senses } : {}),
          lastSeenAt: input.ts,
          seenCount: cur.seenCount + 1,
          sources: mergeSources(cur.sources, input.source),
        },
      },
    };
  }
  return {
    ...store,
    words: {
      ...store.words,
      [key]: {
        word: key,
        literal,
        ...(contextual !== undefined ? { contextual } : {}),
        ...(engine !== undefined ? { engine } : {}),
        savedAt: input.ts,
        lastSeenAt: input.ts,
        seenCount: 1,
        sources: mergeSources([], input.source),
        box: 0,
        dueAt: 0,
      },
    },
  };
}

export interface SaveVocabPhraseInput {
  type: string;
  qid: string;
  index: number;
  /** Texto EN da frase exibida. */
  en: string;
  /** Tradução literal exibida ao expandir (obrigatória). */
  literal: string;
  /** Tradução interpretativa exibida (opcional). */
  contextual?: string;
  /** Mecanismo da tradução exibida (projeto 11, D7). */
  engine?: "glossary" | "ai";
  ts: number;
}

/**
 * Registra o gesto de tradução de uma frase (expansão com tradução exibida).
 * Mesma semântica de saveVocabWord para re-gesto (reconta, mescla nada —
 * frase é única por (type,qid,índice), a fonte é a própria identidade).
 */
export function saveVocabPhrase(store: VocabStore, input: SaveVocabPhraseInput): VocabStore {
  const type = typeof input.type === "string" ? input.type.trim() : "";
  const qid = typeof input.qid === "string" ? input.qid.trim() : "";
  const en = typeof input.en === "string" ? input.en.trim().slice(0, MAX_VOCAB_PHRASE_EN) : "";
  const literal = typeof input.literal === "string" ? input.literal.trim() : "";
  if (!type || !qid || !Number.isInteger(input.index) || input.index < 0 || !en || !literal) {
    return store;
  }
  const key = vocabPhraseKey(type, qid, input.index);
  const contextual =
    typeof input.contextual === "string" && input.contextual.trim() !== ""
      ? input.contextual.trim().slice(0, MAX_VOCAB_CONTEXTUAL)
      : undefined;
  const engine = input.engine === "ai" || input.engine === "glossary" ? input.engine : undefined;
  const cur = store.phrases[key];
  if (cur) {
    return {
      ...store,
      phrases: {
        ...store.phrases,
        [key]: {
          ...cur,
          en,
          literal,
          ...(contextual !== undefined ? { contextual } : {}),
          ...(engine !== undefined ? { engine } : {}),
          lastSeenAt: input.ts,
          seenCount: cur.seenCount + 1,
        },
      },
    };
  }
  return {
    ...store,
    phrases: {
      ...store.phrases,
      [key]: {
        type,
        qid,
        index: input.index,
        en,
        literal,
        ...(contextual !== undefined ? { contextual } : {}),
        ...(engine !== undefined ? { engine } : {}),
        savedAt: input.ts,
        lastSeenAt: input.ts,
        seenCount: 1,
        box: 0,
        dueAt: 0,
      },
    },
  };
}

// ---------- gestão (lista) ----------

/** Remove um item do vocabulário (chave desconhecida → store inalterado). */
export function removeVocabItem(store: VocabStore, kind: VocabKind, key: string): VocabStore {
  if (kind === "word") {
    if (!(key in store.words)) return store;
    const words = { ...store.words };
    delete words[key];
    return { ...store, words };
  }
  if (!(key in store.phrases)) return store;
  const phrases = { ...store.phrases };
  delete phrases[key];
  return { ...store, phrases };
}

/** Liga/desliga o favorito de um item (chave desconhecida → store inalterado). */
export function toggleVocabStar(store: VocabStore, kind: VocabKind, key: string): VocabStore {
  if (kind === "word") {
    const cur = store.words[key];
    if (!cur) return store;
    return { ...store, words: { ...store.words, [key]: { ...cur, starred: !cur.starred } } };
  }
  const cur = store.phrases[key];
  if (!cur) return store;
  return { ...store, phrases: { ...store.phrases, [key]: { ...cur, starred: !cur.starred } } };
}

/**
 * Apaga TODO o vocabulário (projeto 10, Fase 5): devolve um store vazio.
 * Restrito ao vocabulário — tentativas, sessões e ajustes ficam de fora por
 * construção (a função só enxerga o VocabStore). Store vazio → inalterado
 * é irrevogável aqui; a confirmação na UI é quem protege o gesto.
 */
export function clearVocabAll(_store: VocabStore): VocabStore {
  return emptyVocabStore();
}

// ---------- estudo (caixa Leitner própria) ----------

/**
 * Aplica a auto-avaliação de um item de estudo:
 *  - "lembro" (remembered=true): caixa +1 (teto 5), dueAt = ts + intervalo da caixa nova;
 *  - "não lembro": caixa −1 (piso 0), dueAt = ts + intervalo da caixa resultante
 *    (caixa 0 → dueAt 0 = vencido imediatamente).
 * Espelha as regras do SRS de questões (applyAttemptToSnapshot), mas é
 * auto-avaliado — nunca toca no snapshot de questões.
 */
export function applyVocabStudy(
  store: VocabStore,
  kind: VocabKind,
  key: string,
  remembered: boolean,
  ts: number,
): VocabStore {
  const apply = (item: VocabWord | VocabPhrase): VocabWord | VocabPhrase => {
    const box = Math.max(0, Math.min(5, (item.box ?? 0) + (remembered ? 1 : -1)));
    const dueAt = ts + (VOCAB_INTERVAL_DAYS[box] ?? 30) * DAY_MS;
    return { ...item, box, dueAt };
  };
  if (kind === "word") {
    const cur = store.words[key];
    if (!cur) return store;
    return { ...store, words: { ...store.words, [key]: apply(cur) as VocabWord } };
  }
  const cur = store.phrases[key];
  if (!cur) return store;
  return { ...store, phrases: { ...store.phrases, [key]: apply(cur) as VocabPhrase } };
}

// ---------- contagens e poda ----------

/** Itens "para revisar" (dueAt ≤ now; caixa 0 é sempre vencida). */
export function vocabDueCount(store: VocabStore, now: number): number {
  let due = 0;
  for (const w of Object.values(store.words)) if (w.dueAt <= now) due += 1;
  for (const p of Object.values(store.phrases)) if (p.dueAt <= now) due += 1;
  return due;
}

export function vocabCounts(store: VocabStore): { words: number; phrases: number; total: number } {
  const words = Object.keys(store.words ?? {}).length;
  const phrases = Object.keys(store.phrases ?? {}).length;
  return { words, phrases, total: words + phrases };
}

/** Poda o vocabulário ao teto, evaporando os lastSeenAt mais antigos primeiro.
 * Favoritos NUNCA são podados (projeto 13, §4.3): se todos os excedentes
 * forem favoritos, o teto estoura em vez de perder item marcado. */
export function pruneVocab(store: VocabStore, max: number = MAX_VOCAB_ITEMS): VocabStore {
  const entries: { kind: VocabKind; key: string; lastSeenAt: number; starred?: boolean }[] = [
    ...Object.entries(store.words ?? {}).map(([key, w]) => ({
      kind: "word" as const,
      key,
      lastSeenAt: w.lastSeenAt,
      ...(w.starred === true ? { starred: true } : {}),
    })),
    ...Object.entries(store.phrases ?? {}).map(([key, p]) => ({
      kind: "phrase" as const,
      key,
      lastSeenAt: p.lastSeenAt,
      ...(p.starred === true ? { starred: true } : {}),
    })),
  ];
  if (entries.length <= max) return store;
  const byOld = [...entries].sort((a, b) => a.lastSeenAt - b.lastSeenAt);
  const drop = new Set(
    byOld
      .filter((e) => e.starred !== true)
      .slice(0, entries.length - max)
      .map((e) => `${e.kind}:${e.key}`),
  );
  const words: Record<string, VocabWord> = {};
  for (const [key, w] of Object.entries(store.words)) if (!drop.has(`word:${key}`)) words[key] = w;
  const phrases: Record<string, VocabPhrase> = {};
  for (const [key, p] of Object.entries(store.phrases))
    if (!drop.has(`phrase:${key}`)) phrases[key] = p;
  return { words, phrases };
}

// ---------- normalização (entrada de estado/backup) ----------

function clampBox(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(5, Math.round(v))) : 0;
}

function normNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
}

function normSources(raw: unknown): VocabSource[] {
  if (!Array.isArray(raw)) return [];
  const out: VocabSource[] = [];
  for (const s of raw) {
    const t = (s ?? {}) as Partial<VocabSource>;
    if (typeof t.type === "string" && t.type && typeof t.qid === "string" && t.qid) {
      if (!out.some((x) => x.type === t.type && x.qid === t.qid))
        out.push({ type: t.type, qid: t.qid });
    }
  }
  return out.slice(-MAX_VOCAB_SOURCES);
}

/** Normaliza sentidos acumulados (projeto 13, §4.3): descarta sem literal,
 * cap MAX_VOCAB_SENSES — os mais recentes por último. */
function normSenses(raw: unknown): VocabSense[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: VocabSense[] = [];
  for (const s of raw) {
    const e = (s ?? {}) as Partial<VocabSense>;
    const literal =
      typeof e.literal === "string" ? e.literal.trim().slice(0, MAX_VOCAB_CONTEXTUAL) : "";
    if (!literal) continue;
    out.push({
      literal,
      ...(typeof e.contextual === "string" && e.contextual.trim() !== ""
        ? { contextual: e.contextual.trim().slice(0, MAX_VOCAB_CONTEXTUAL) }
        : {}),
      ...(e.engine === "ai" || e.engine === "glossary" ? { engine: e.engine } : {}),
      ts: normNumber(e.ts, 0),
    });
  }
  return out.length > 0 ? out.slice(-MAX_VOCAB_SENSES) : undefined;
}

/**
 * Normaliza o vocabulário de qualquer estado/backup: descarta entradas
 * malformadas (sem tradução), clampa caixas, cap de fontes, dedupe de chaves e
 * poda ao teto. NUNCA inventa tradução — o que não tem literal sai.
 */
export function normalizeVocabStore(raw: unknown): VocabStore {
  const obj = (raw ?? {}) as Partial<VocabStore>;
  const words: Record<string, VocabWord> = {};
  if (obj.words && typeof obj.words === "object") {
    for (const [key, w] of Object.entries(obj.words as Record<string, unknown>)) {
      const x = (w ?? {}) as Partial<VocabWord>;
      const word = typeof x.word === "string" ? vocabWordKey(x.word) : vocabWordKey(key);
      const literal = typeof x.literal === "string" ? x.literal.trim() : "";
      if (!word || !literal) continue;
      const savedAt = normNumber(x.savedAt, 0);
      words[word] = {
        word,
        literal,
        ...(typeof x.contextual === "string" && x.contextual.trim() !== ""
          ? { contextual: x.contextual.trim().slice(0, MAX_VOCAB_CONTEXTUAL) }
          : {}),
        savedAt,
        lastSeenAt: Math.max(normNumber(x.lastSeenAt, savedAt), savedAt),
        seenCount: Math.max(1, Math.round(normNumber(x.seenCount, 1))),
        ...(normSenses(x.senses) ? { senses: normSenses(x.senses)! } : {}),
        sources: normSources(x.sources),
        box: clampBox(x.box),
        dueAt: normNumber(x.dueAt, 0),
        ...(x.starred === true ? { starred: true } : {}),
        ...(x.engine === "ai" || x.engine === "glossary" ? { engine: x.engine } : {}),
      };
    }
  }
  const phrases: Record<string, VocabPhrase> = {};
  if (obj.phrases && typeof obj.phrases === "object") {
    for (const [key, p] of Object.entries(obj.phrases as Record<string, unknown>)) {
      const x = (p ?? {}) as Partial<VocabPhrase>;
      const type = typeof x.type === "string" ? x.type.trim() : "";
      const qid = typeof x.qid === "string" ? x.qid.trim() : "";
      const index =
        typeof x.index === "number" && Number.isInteger(x.index) && x.index >= 0 ? x.index : -1;
      const en = typeof x.en === "string" ? x.en.trim().slice(0, MAX_VOCAB_PHRASE_EN) : "";
      const literal = typeof x.literal === "string" ? x.literal.trim() : "";
      if (!type || !qid || index < 0 || !en || !literal) continue;
      const k = vocabPhraseKey(type, qid, index);
      const savedAt = normNumber(x.savedAt, 0);
      phrases[k] = {
        type,
        qid,
        index,
        en,
        literal,
        ...(typeof x.contextual === "string" && x.contextual.trim() !== ""
          ? { contextual: x.contextual.trim().slice(0, MAX_VOCAB_CONTEXTUAL) }
          : {}),
        savedAt,
        lastSeenAt: Math.max(normNumber(x.lastSeenAt, savedAt), savedAt),
        seenCount: Math.max(1, Math.round(normNumber(x.seenCount, 1))),
        box: clampBox(x.box),
        dueAt: normNumber(x.dueAt, 0),
        ...(x.starred === true ? { starred: true } : {}),
        ...(x.engine === "ai" || x.engine === "glossary" ? { engine: x.engine } : {}),
      };
    }
  }
  return pruneVocab({ words, phrases });
}

// ---------- visão de lista (projeto 10, Fase 3) ----------

/** Item achatado para a lista unificada de palavras e frases. */
export interface VocabListItem {
  kind: VocabKind;
  /** Chave no store (vocabWordKey / vocabPhraseKey). */
  key: string;
  /** Texto em inglês (a palavra ou a frase). */
  en: string;
  literal: string;
  contextual?: string;
  savedAt: number;
  lastSeenAt: number;
  seenCount: number;
  box: number;
  dueAt: number;
  starred?: boolean;
  sources: VocabSource[];
  /** Só palavras: sentidos anteriores acumulados (projeto 13, §4.3). */
  senses?: VocabSense[];
  /** Só frases: origem exata. */
  type?: string;
  qid?: string;
  index?: number;
}

/** Achata o store em uma lista estável (palavras depois frases, ordem de inserção). */
export function flattenVocab(store: VocabStore): VocabListItem[] {
  const words = Object.entries(store.words ?? {}).map(([key, w]) => ({
    kind: "word" as const,
    key,
    en: w.word,
    literal: w.literal,
    ...(w.contextual !== undefined ? { contextual: w.contextual } : {}),
    ...(w.senses?.length ? { senses: w.senses } : {}),
    savedAt: w.savedAt,
    lastSeenAt: w.lastSeenAt,
    seenCount: w.seenCount,
    box: w.box,
    dueAt: w.dueAt,
    ...(w.starred === true ? { starred: true } : {}),
    sources: w.sources,
  }));
  const phrases = Object.entries(store.phrases ?? {}).map(([key, p]) => ({
    kind: "phrase" as const,
    key,
    en: p.en,
    literal: p.literal,
    ...(p.contextual !== undefined ? { contextual: p.contextual } : {}),
    savedAt: p.savedAt,
    lastSeenAt: p.lastSeenAt,
    seenCount: p.seenCount,
    box: p.box,
    dueAt: p.dueAt,
    ...(p.starred === true ? { starred: true } : {}),
    sources: [],
    type: p.type,
    qid: p.qid,
    index: p.index,
  }));
  return [...words, ...phrases];
}

export type VocabKindFilter = "todas" | VocabKind;
export type VocabSort = "recentes" | "mais-traduzidas" | "a-z" | "para-revisar";

export interface VocabFilterOptions {
  query?: string;
  kind?: VocabKindFilter;
  /** Seção de origem ou "todas" (ex.: "speaking"). */
  section?: string;
  starredOnly?: boolean;
  sort?: VocabSort;
  /** Momento "agora" para o filtro "para revisar". */
  now?: number;
  /** Mapeamento item → seção de origem, fornecido pela UI (via manifesto). */
  sectionOf?: (item: VocabListItem) => string | undefined;
  /** União de seções do item (projeto 13, §4.3) — fontes de palavra e o tipo da frase. */
  sectionsOf?: (item: VocabListItem) => string[];
}

const normalizeQuery = (q: string) => q.trim().toLowerCase();

/**
 * Busca + filtros + ordenação da lista de vocabulário (pura, testável).
 * Busca casa o texto EN e a tradução pt-BR, case-insensitive, substring.
 */
export function filterVocab(
  items: VocabListItem[],
  opts: VocabFilterOptions = {},
): VocabListItem[] {
  const query = normalizeQuery(opts.query ?? "");
  const kind = opts.kind ?? "todas";
  const section = opts.section ?? "todas";
  const starredOnly = opts.starredOnly === true;
  const sort = opts.sort ?? "recentes";
  const now = opts.now ?? Date.now();

  let out = items.filter((it) => {
    if (kind !== "todas" && it.kind !== kind) return false;
    if (starredOnly && it.starred !== true) return false;
    if (query) {
      const hay = `${it.en} ${it.literal} ${it.contextual ?? ""}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  if (section !== "todas") {
    if (opts.sectionsOf) {
      const secsOf = opts.sectionsOf;
      out = out.filter((it) => secsOf(it).includes(section));
    } else if (opts.sectionOf) {
      const secOf = opts.sectionOf;
      out = out.filter((it) => secOf(it) === section);
    }
  }

  const byRecent = (a: VocabListItem, b: VocabListItem) => b.lastSeenAt - a.lastSeenAt;
  if (sort === "recentes") out = [...out].sort(byRecent);
  else if (sort === "mais-traduzidas")
    out = [...out].sort((a, b) => b.seenCount - a.seenCount || byRecent(a, b));
  else if (sort === "a-z") out = [...out].sort((a, b) => a.en.localeCompare(b.en, "en"));
  else if (sort === "para-revisar")
    out = [...out].sort((a, b) => a.dueAt - b.dueAt || byRecent(a, b));
  return out;
}
