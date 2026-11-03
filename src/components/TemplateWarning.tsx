import type { TemplateVerdict } from "@/lib/pte/templateDetector";

/**
 * Aviso rotulado de resposta-modelo (projeto 9, Fase 3). Nunca muda o score —
 * apenas informa que a Pearson pode enviar respostas assim para revisão humana.
 */
export function TemplateWarning({ verdict }: { verdict: TemplateVerdict | null }) {
  if (!verdict?.likelyTemplate) return null;
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
      <p className="font-medium text-warning">Resposta parece modelo (template)</p>
      <p className="mt-1 text-muted-foreground">
        A Pearson pode enviar respostas assim para revisão humana. Prefira escrever com suas
        próprias palavras — o score não muda; este é só um aviso.
      </p>
      {verdict.reasons.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
          {verdict.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
