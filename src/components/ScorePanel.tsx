import type { GradeResult } from "@/lib/scoring";
import { fluencyProxy, paceLabel } from "@/lib/scoring";
import { StatHero } from "@/components/layout/StatHero";
import { cn } from "@/lib/utils";

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Resultado de fala (projeto 12, S3): score como número-herói, fluência e pronúncia secundárias. */
export function ScorePanel({ grade }: { grade: GradeResult }) {
  const paceTone = grade.paceVerdict === "ideal" ? "text-success" : "text-warning";
  const fluency = fluencyProxy(grade.pauses, grade.paceVerdict);
  const fluencyTone =
    fluency >= 80 ? "text-success" : fluency >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card sm:p-6">
      <StatHero
        value={grade.score}
        label="Conteúdo"
        hint="Estimativa de treino · 0–100"
        className={cn(
          grade.score >= 90
            ? "text-success"
            : grade.score >= 70
              ? "text-warning"
              : "text-destructive",
        )}
      />

      <p className="mt-3 text-xs text-muted-foreground">
        O reconhecedor do navegador pode corrigir palavras para as mais prováveis — o score tende a
        ficar otimista.
      </p>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Fluência (proxy)
          </dt>
          <dd className={cn("mt-1 font-serif text-2xl font-semibold tabular-nums", fluencyTone)}>
            {fluency}
          </dd>
          <dd className="text-xs text-muted-foreground">ritmo e pausas</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pronúncia
          </dt>
          <dd className="mt-1 font-serif text-2xl font-semibold text-muted-foreground/60">—</dd>
          <dd className="text-xs text-muted-foreground">não avaliada</dd>
        </div>
      </dl>

      <p className={cn("mt-5 text-sm font-medium", paceTone)}>{paceLabel(grade.paceVerdict)}</p>

      <p className="mt-2 text-xs tabular-nums text-muted-foreground">
        {grade.wpm} palavras/min · duração {formatDuration(grade.durationMs)} · pausas longas:{" "}
        {grade.pauses} · repetições: {grade.repetitions}
        {grade.moved > 0 ? ` · fora de ordem: ${grade.moved}` : ""}
      </p>

      {grade.mastered ? (
        <p className="mt-3 text-sm font-medium text-success">
          Dominada — conteúdo e ritmo na faixa ideal do PTE.
        </p>
      ) : null}

      {grade.moved > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Palavras <span className="text-info underline decoration-dotted">pontilhadas</span>{" "}
          estavam certas, mas fora de ordem — vale crédito parcial. Atenção à sequência das ideias.
        </p>
      ) : null}

      {grade.extras.length > 0 ? (
        <div className="mt-2 text-sm">
          <span className="text-muted-foreground">Palavras fora do passage: </span>
          <span className="text-info">{grade.extras.slice(0, 12).join(", ")}</span>
        </div>
      ) : null}

      {grade.transcript ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-secondary/40 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            O que captamos
          </p>
          <p className="mt-2 text-sm italic leading-relaxed text-foreground/85">
            {grade.transcript}
          </p>
        </div>
      ) : null}
    </div>
  );
}
