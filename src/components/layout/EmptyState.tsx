import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Ação primária (botão/link) quando existe um próximo passo. */
  action?: ReactNode;
  className?: string;
}

/**
 * Estado vazio unificado (PRD §8): título serif, explicação honesta e CTA
 * contextual — nunca só um texto solto explicando ausência de dados.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center shadow-card",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <Icon className="size-6" strokeWidth={2} />
      </span>
      <h2 className="mt-4 font-serif text-lg font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
