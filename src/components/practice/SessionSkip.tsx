import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { sessionFinished, sessionNextId, skipSessionItem, type SkipReason } from "@/lib/session";

const REASONS: [SkipReason, string][] = [
  ["asr", "Microfone ou áudio indisponível"],
  ["technical", "Problema técnico (tela, som ou texto)"],
];

/**
 * Pular/reagendar a questão atual da sessão (projeto 13, §4.2): escolhe o
 * motivo e a questão volta ao fim da fila — sem penalidade de score e sem
 * contar como concluída. Só aparece quando a questão é a atual da sessão.
 */
export function SessionSkip({ qid }: { qid: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (sessionNextId() !== qid) return null;

  const goNext = () => {
    if (sessionFinished()) {
      navigate({ to: "/session", search: { done: true } });
      return;
    }
    const nid = sessionNextId();
    if (nid) navigate({ to: "/practice", search: { q: nid } });
    else navigate({ to: "/session", search: { done: true } });
  };

  const skip = (reason: SkipReason) => {
    skipSessionItem(reason);
    setOpen(false);
    goNext();
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        aria-expanded={open}
        aria-haspopup="true"
        className="min-h-11 min-w-[44px] text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        Pular
      </Button>
      {open ? (
        <div
          role="group"
          aria-label="Motivo para pular a questão"
          className="absolute bottom-full right-0 z-30 mb-2 w-64 rounded-xl border border-border/60 bg-card p-3 shadow-pop"
        >
          <p className="text-xs leading-snug text-muted-foreground">
            A questão volta ao fim da fila, sem nota e sem contar como concluída.
          </p>
          <div className="mt-2 grid gap-1">
            {REASONS.map(([reason, label]) => (
              <Button
                key={reason}
                size="sm"
                variant="outline"
                className="min-h-11 justify-start whitespace-normal text-left"
                onClick={() => skip(reason)}
              >
                {label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11 text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
