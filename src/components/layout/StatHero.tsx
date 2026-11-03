import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StatHeroProps {
  value: ReactNode;
  label?: string;
  /** Contexto curto sob o número (ex.: "de 90"). */
  hint?: string;
  className?: string;
}

/**
 * Número-herói (PRD §8): valor grande com numerais tabulares — scores,
 * contagens e metas têm sempre esta cara.
 */
export function StatHero({ value, label, hint, className }: StatHeroProps) {
  return (
    <div className={cn("min-w-0", className)}>
      {label ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
      ) : null}
      <p className="mt-1 font-serif text-4xl font-semibold tabular-nums tracking-tight text-foreground sm:text-5xl">
        {value}
      </p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
