/**
 * Chip do mecanismo de tradução (PRD projeto 11, §10): o chip sempre reflete
 * o conteúdo exibido no card — nunca o mecanismo "esperado". Discreto e
 * honesto: "IA" quando o card veio do gateway; "Cache IA" quando veio do
 * cache da IA (projeto 13, D7 — offline/pausado serve tradução já paga);
 * "Dicionário" quando veio do pack; "Dicionário (modo offline)" quando a
 * IA estava indisponível (sem internet, cooldown ou pausa de créditos).
 */
import { cn } from "@/lib/utils";

export type Mechanism = "ai" | "ai-cache" | "dictionary" | "dictionary-offline";

const LABELS: Record<Mechanism, string> = {
  ai: "IA",
  "ai-cache": "Cache IA",
  dictionary: "Dicionário",
  "dictionary-offline": "Dicionário (modo offline)",
};

export function MechanismChip({ mechanism }: { mechanism: Mechanism }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground",
        (mechanism === "ai" || mechanism === "ai-cache") && "border-primary/40 text-primary",
      )}
    >
      {LABELS[mechanism]}
    </span>
  );
}
