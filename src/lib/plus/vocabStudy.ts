// Projeto 10, Fase 4 — fila de estudo do vocabulário (pura, testável).
// A aplicação de "lembro/não lembro" fica em vocab.ts (applyVocabStudy); aqui só
// se decide a ORDEM em que os cartões aparecem na sessão.
import type { VocabListItem } from "./vocab";

export interface VocabStudyCard extends VocabListItem {
  /** Caixa Leitner no momento em que a fila foi montada. */
  box: number;
  /** Momento em que o item vence (0 = caixa 0, vencido imediatamente). */
  dueAt: number;
}

export interface VocabQueueOptions {
  /** Momento "agora" da sessão. */
  now: number;
  /** Limite opcional de cartões por sessão. */
  limit?: number;
}

/** Ordem base dentro de cada partição: mais vencido primeiro, depois menos visto. */
const byDue = (a: VocabListItem, b: VocabListItem) =>
  a.dueAt - b.dueAt || a.lastSeenAt - b.lastSeenAt;

/**
 * Intercala palavras e frases (uma de cada, alternado) para a sessão não virar
 * um bloco só de palavras. Começa pelo grupo com o item mais antigo da lista.
 */
function interleaveKinds(list: VocabListItem[]): VocabListItem[] {
  const words: VocabListItem[] = [];
  const phrases: VocabListItem[] = [];
  for (const it of list) (it.kind === "word" ? words : phrases).push(it);
  const startWithWords =
    phrases.length === 0 ||
    (words.length > 0 &&
      (words[0]!.dueAt < phrases[0]!.dueAt ||
        (words[0]!.dueAt === phrases[0]!.dueAt && words[0]!.lastSeenAt <= phrases[0]!.lastSeenAt)));
  const first = startWithWords ? words : phrases;
  const second = startWithWords ? phrases : words;
  const out: VocabListItem[] = [];
  for (let i = 0; i < Math.max(first.length, second.length); i += 1) {
    if (i < first.length) out.push(first[i]!);
    if (i < second.length) out.push(second[i]!);
  }
  return out;
}

/**
 * Fila de estudo: vencidos → favoritos → demais, com palavras e frases
 * intercaladas. Itens já estudados nesta lista continuam elegíveis; a sessão
 * usa o snapshot no momento em que foi montada.
 */
export function buildStudyQueue(items: VocabListItem[], opts: VocabQueueOptions): VocabStudyCard[] {
  const now = opts.now;
  const due: VocabListItem[] = [];
  const starred: VocabListItem[] = [];
  const rest: VocabListItem[] = [];
  for (const it of items) {
    if (it.dueAt <= now) due.push(it);
    else if (it.starred === true) starred.push(it);
    else rest.push(it);
  }
  due.sort(byDue);
  starred.sort(byDue);
  rest.sort(byDue);
  const ordered = [...interleaveKinds(due), ...interleaveKinds(starred), ...interleaveKinds(rest)];
  const limited = opts.limit !== undefined ? ordered.slice(0, Math.max(0, opts.limit)) : ordered;
  return limited.map((it) => ({ ...it, box: it.box, dueAt: it.dueAt }));
}

/**
 * Reaprendizado na sessão (projeto 13, §4.3): "não lembrei" devolve o cartão
 * ao FIM da fila atual — UMA repetição por item por sessão. Puro: devolve a
 * fila inalterada quando o item já foi reagendado uma vez.
 */
export function requeueCard(queue: VocabStudyCard[], card: VocabStudyCard): VocabStudyCard[] {
  const occurrences = queue.filter((c) => c.key === card.key && c.kind === card.kind).length;
  if (occurrences >= 2) return queue;
  return [...queue, card];
}
