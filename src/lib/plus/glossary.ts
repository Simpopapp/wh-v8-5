/** Entrada do glossário do pack "studie-plus" (EN → pt-BR). */
export interface GlossaryEntry {
  /** Tradução literal mais comum (1–3 palavras, minúsculas). */
  literal: string;
  /** Nota curta de uso/nuance em contexto acadêmico (opcional). */
  contextual?: string;
}

/** Formato de `src/data/plus/glossary.json`: palavra minúscula → entrada. */
export type Glossary = Record<string, GlossaryEntry>;

/**
 * Lookup exato: minúsculas + remove pontuação externa, sem lematização
 * inventada. Palavra ausente → null (a UI mostra estado vazio, nunca
 * tradução errada).
 */
export function lookupWord(glossary: Glossary, token: string): GlossaryEntry | null {
  const core = token
    .toLowerCase()
    .replace(/^[\W_]+|[\W_]+$/g, "")
    .replace(/[\u2019]/g, "'");
  if (!core) return null;
  const hit = glossary[core];
  if (!hit || typeof hit.literal !== "string" || hit.literal.trim() === "") return null;
  return hit.contextual
    ? { literal: hit.literal, contextual: hit.contextual }
    : { literal: hit.literal };
}
