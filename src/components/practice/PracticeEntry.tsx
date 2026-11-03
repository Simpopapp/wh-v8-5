import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, History, ListFilter, Sparkles, TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { TYPE_META, firstIdOfType, getMeta, typeCounts, type TaskType } from "@/lib/pte";
import { buildDailyPlan } from "@/lib/pte/studyPlan";
import { computeStats, useAppState } from "@/lib/storage";

/**
 * Entrada do /practice (projeto 13, §4.4.1 / S4): retomar a última questão,
 * recomendação do dia (plano diário) e busca por tipo — sem redirecionar
 * silenciosamente para a primeira questão. IDs inválidos avisam aqui.
 */
export function PracticeEntry({ invalidId }: { invalidId?: string }) {
  const app = useAppState();
  const stats = useMemo(() => computeStats(app), [app]);
  const plan = useMemo(() => buildDailyPlan(app, stats), [app, stats]);

  // Retomar: tentativa mais recente cuja questão ainda existe no catálogo.
  const lastQid = useMemo(() => {
    const sorted = [...app.attempts].sort((a, b) => b.ts - a.ts);
    for (const a of sorted) {
      if (getMeta(a.qid)) return a.qid;
    }
    return null;
  }, [app.attempts]);

  // Recomendação: primeiro tipo com cota do plano e estoque real.
  const recommended = useMemo(() => {
    const types = Object.keys(plan.counts) as TaskType[];
    for (const t of types) {
      if ((plan.counts[t] ?? 0) > 0 && firstIdOfType(t)) return t;
    }
    return null;
  }, [plan]);
  const recommendedId = recommended ? firstIdOfType(recommended) : undefined;

  const types = useMemo(
    () =>
      (Object.keys(TYPE_META) as TaskType[]).filter(
        (t) => TYPE_META[t].ready && typeCounts[t] > 0 && firstIdOfType(t),
      ),
    [],
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <PageHeader
          kicker="Praticar"
          title="Escolha sua questão"
          subtitle="Retome de onde parou, siga a recomendação do dia ou escolha um tipo de tarefa."
        />

        {invalidId ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <span className="min-w-0 break-words">
              A questão <span className="font-medium">{invalidId}</span> não foi encontrada. Escolha
              um tipo abaixo ou volte ao início.
            </span>
          </p>
        ) : null}

        {/* Retomar — tentativa mais recente ainda existente (projeto 13, S4). */}
        {lastQid && getMeta(lastQid) ? (
          <Link
            to="/practice"
            search={{ q: lastQid }}
            className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:shadow-pop focus-visible:shadow-pop motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none"
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <History className="size-5" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-lg font-semibold text-foreground group-hover:text-primary">
                Continuar de onde parei
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                {TYPE_META[getMeta(lastQid)!.taskType].label} · {getMeta(lastQid)!.topic}
              </span>
            </span>
            <ArrowUpRight
              aria-hidden
              className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ) : null}

        {/* Recomendação do dia — mesma composição do plano diário (Fase 2). */}
        {recommended && recommendedId ? (
          <Link
            to="/practice"
            search={{ q: recommendedId }}
            className="group flex items-center gap-4 rounded-2xl border border-primary/20 bg-card bg-glow p-5 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:shadow-pop focus-visible:shadow-pop motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none"
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Sparkles className="size-5" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-lg font-semibold text-foreground group-hover:text-primary">
                Recomendação de hoje
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {TYPE_META[recommended].label} · {plan.counts[recommended]} questão(ões) no plano de
                hoje
              </span>
            </span>
            <ArrowUpRight
              aria-hidden
              className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ) : null}

        {/* Busca por tipo — catálogo real (TYPE_META + contagens). */}
        <section aria-labelledby="escolha-tipo-title">
          <h2 id="escolha-tipo-title" className="font-serif text-xl font-semibold">
            Buscar por tipo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {types.length} tipos com questões disponíveis.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {types.map((t) => (
              <li key={t}>
                <Button asChild variant="outline" size="sm" className="min-h-11 whitespace-normal">
                  <Link to="/practice" search={{ q: firstIdOfType(t)! }}>
                    {TYPE_META[t].label}
                    <span className="tabular-nums text-muted-foreground"> · {typeCounts[t]}</span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ListFilter aria-hidden className="size-3.5" />
            Dica: dentro de uma questão, navegue com ← / → ou favorite com B.
          </p>
        </section>
      </main>
    </div>
  );
}
