/**
 * Card IA do modelo A (PRD projeto 11, §3.1): as três partes do planejamento —
 * literal (tipo 1), "na frase" com o porquê (tipo 2) e "por que não
 * {sinônimo}?" com veredito Errado/Certo/Certo, mas menos cabível (tipo 3).
 * Só conteúdo: cabeçalho, áudio, chip e rodapé de captura ficam no portal do
 * PlusWordText (mesma âncora, mesmos portais).
 */
import type { AiWordResult } from "@/lib/plus/aiSchemas";
import { cn } from "@/lib/utils";

const VERDICT_LABELS: Record<AiWordResult["synonym"]["verdict"], string> = {
  wrong: "Errado",
  right: "Certo",
  mcnc: "Certo, mas menos cabível",
};

/** Estilos por veredito (tokens do tema — nada hardcoded). */
function verdictStyle(verdict: AiWordResult["synonym"]["verdict"]): string {
  if (verdict === "wrong") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (verdict === "right") return "border-primary/40 bg-primary/10 text-primary";
  return "border-border bg-secondary text-secondary-foreground";
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
    {children}
  </p>
);

export function AiWordCard({ result }: { result: AiWordResult }) {
  return (
    <div>
      <section aria-label="Significado literal">
        <SectionLabel>Literal</SectionLabel>
        <p className="text-sm font-medium text-foreground">{result.literal}</p>
      </section>

      <section aria-label="Significado nesta frase" className="mt-2.5">
        <SectionLabel>Na frase</SectionLabel>
        <p className="text-sm leading-relaxed text-foreground">
          Aqui, “{result.word}” significa: {result.inSentence.translation}
        </p>
        {result.inSentence.why ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {result.inSentence.why}
          </p>
        ) : null}
      </section>

      {result.synonym.common ? (
        <section aria-label="Alternativa mais comum" className="mt-2.5 border-t border-border pt-2">
          <SectionLabel>Por que não “{result.synonym.common}”?</SectionLabel>
          <span
            className={cn(
              "mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              verdictStyle(result.synonym.verdict),
            )}
          >
            {VERDICT_LABELS[result.synonym.verdict]}
          </span>
          {result.synonym.explanation ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {result.synonym.explanation}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/** Skeleton de 3 blocos (Literal · Na frase · Por que não…) enquanto gera. */
export function AiWordSkeleton() {
  return (
    <div aria-label="Traduzindo com IA" aria-busy="true">
      <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
      <div className="mt-2 h-4 w-full animate-pulse rounded bg-secondary" />
      <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-secondary" />
      <div className="mt-3 h-3 w-20 animate-pulse rounded bg-secondary" />
      <div className="mt-2 h-4 w-full animate-pulse rounded bg-secondary" />
      <div className="mt-1.5 h-4 w-2/3 animate-pulse rounded bg-secondary" />
    </div>
  );
}
