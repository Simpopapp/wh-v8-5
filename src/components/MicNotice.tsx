import { Mic, X } from "lucide-react";

import { dismissMicNotice, useMicNotice } from "@/lib/useSpeechRecognition";

/**
 * Aviso de 1º uso do microfone (projeto 9, Fase 3): explica para que o áudio
 * é usado antes de o usuário confiar no reconhecimento. Aparece uma vez por
 * navegador (flag em settings) e pode ser fechado.
 */
export function MicNotice() {
  const notice = useMicNotice();
  if (!notice) return null;
  return (
    <div
      role="status"
      className="rounded-xl border border-info/40 bg-info/10 px-4 py-3 text-sm text-foreground"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 shrink-0 text-info">
          <Mic className="size-4.5" strokeWidth={2} />
        </span>
        <p className="flex-1 leading-relaxed">{notice}</p>
        <button
          type="button"
          onClick={dismissMicNotice}
          aria-label="Fechar aviso sobre o microfone"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
