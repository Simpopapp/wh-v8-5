/**
 * Card IA do modelo B (PRD projeto 11, §3.2): tradução completa da frase +
 * lista intercalada de dicas — para cada expressão/gíria/termo
 * contraintuitivo, o termo destacado seguido da explicação de por que não foi
 * traduzido ao pé da letra. Sem dicas, a seção não aparece (nunca lista
 * vazia com título). Só conteúdo: cabeçalho, chip e captura ficam no
 * PlusPhraseCard (mesma lista, mesma expansão).
 */
import type { AiPhraseResult } from "@/lib/plus/aiSchemas";

export function AiPhraseCard({ result }: { result: AiPhraseResult }) {
  return (
    <div>
      <p className="text-sm font-medium leading-relaxed text-foreground">{result.translation}</p>
      {result.tips.length > 0 ? (
        <section
          aria-label="Dicas de expressões e termos"
          className="mt-2 border-t border-border pt-2"
        >
          <ul className="space-y-1.5">
            {result.tips.map((tip, i) => (
              <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                  {tip.term}
                </span>{" "}
                — {tip.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Skeleton de 2 blocos (tradução + dicas) enquanto gera. */
export function AiPhraseSkeleton() {
  return (
    <div aria-label="Traduzindo com IA" aria-busy="true">
      <div className="h-4 w-full animate-pulse rounded bg-secondary" />
      <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-secondary" />
      <div className="mt-3 h-3 w-24 animate-pulse rounded bg-secondary" />
      <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-secondary" />
    </div>
  );
}
