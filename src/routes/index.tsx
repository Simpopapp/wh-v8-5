import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowUpRight, BookA, BookMarked, CalendarCheck } from "lucide-react";

import { usePageFocusTarget } from "@/lib/pageFocus";

import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { SectionIcon, SECTION_TEXT } from "@/components/layout/SectionIdentity";
import { StatHero } from "@/components/layout/StatHero";
import {
  SECTION_META,
  SECTION_ORDER,
  TYPE_META,
  TOTAL_ALL_QUESTIONS_LABEL,
  TYPE_COUNT,
  firstIdOfType,
  getMeta,
  sectionCountLabel,
} from "@/lib/pte";
import { estimateTargetLabel } from "@/lib/pte/goal";
import { overallEstimate } from "@/lib/pte/readiness";
import { vocabCounts, vocabDueCount } from "@/lib/plus/vocab";
import {
  buildHomeDailyAction,
  hasStudyActivity,
  resumeLabel,
  selectHomeResume,
} from "@/lib/home";
import { computeStats, useAppState } from "@/lib/storage";
import { formatSessionDuration, sessionNextId, startMixedSession } from "@/lib/session";
import type { Section, TaskType } from "@/lib/pte/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: `PTE Master Hub — treine o PTE Academic com ${TOTAL_ALL_QUESTIONS_LABEL} questões para praticar`,
      },
      {
        name: "description",
        content: `Pratique o PTE Academic com ${TOTAL_ALL_QUESTIONS_LABEL} questões em ${TYPE_COUNT} tipos de tarefa, nas quatro seções da prova. Correção palavra por palavra, revisão espaçada e progresso salvo no seu navegador.`,
      },
      { property: "og:title", content: "PTE Master Hub" },
      {
        property: "og:description",
        content: `Treine o PTE Academic com ${TOTAL_ALL_QUESTIONS_LABEL} questões para praticar — fala, escrita, leitura e escuta.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const sectionToPath: Record<Section, "/speaking" | "/writing" | "/reading" | "/listening"> = {
  speaking: "/speaking",
  writing: "/writing",
  reading: "/reading",
  listening: "/listening",
};

/** Objetivo editorial por seção (projeto 12, S2): conteúdo, não métrica inventada. */
const SECTION_FOCUS: Record<Section, string> = {
  speaking: "Foco do treino: clareza e fluência.",
  writing: "Foco do treino: síntese e estrutura.",
  reading: "Foco do treino: compreensão e precisão.",
  listening: "Foco do treino: escuta e reconhecimento.",
};

/** Hover do título do card por seção — classes literais (Tailwind não compila classes dinâmicas). */
const SECTION_HOVER: Record<Section, string> = {
  speaking: "group-hover:text-section-speaking",
  writing: "group-hover:text-section-writing",
  reading: "group-hover:text-section-reading",
  listening: "group-hover:text-section-listening",
};

/** Primeiro task type (com itens) da seção, na ordem do catálogo. */
function sectionFirstType(section: Section): TaskType | undefined {
  return (Object.keys(TYPE_META) as TaskType[]).find(
    (t) => TYPE_META[t].section === section && firstIdOfType(t),
  );
}

/** Score-card de estimativa (projeto 12, S2): número tabular grande + rótulo — só quando há treino. */
function TargetStrip() {
  const app = useAppState();
  const estimate = useMemo(() => overallEstimate(app), [app]);
  if (estimate === null) return null;
  return (
    <section
      aria-label="Estimativa de treino"
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <StatHero value={estimate} label="Estimativa de treino" hint="Escala 10–90" />
      <div className="flex flex-col gap-1 sm:items-end">
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-right">
          {estimateTargetLabel(estimate, app.settings.targetScore)}
        </p>
        <Link
          to="/progress"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver meu progresso
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/** Anel decorativo do cartão de vocabulário: fração de itens vencidos (due/total). */
function VocabRing({ due, total }: { due: number; total: number }) {
  const frac = total > 0 ? Math.min(1, due / total) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span aria-hidden className="relative inline-flex shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-secondary" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-serif text-lg font-semibold tabular-nums text-foreground">
        {due}
      </span>
    </span>
  );
}

/** Cartão de atalho "Meu vocabulário" (projeto 10, Fase 5): contagem viva ou convite. */
function VocabCard() {
  const app = useAppState();
  const counts = useMemo(() => vocabCounts(app.vocabulary), [app.vocabulary]);
  const due = useMemo(() => vocabDueCount(app.vocabulary, Date.now()), [app.vocabulary]);
  const hasAny = counts.total > 0;
  return (
    <Link
      to="/vocabulary"
      className="group flex h-full flex-col rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:shadow-pop focus-visible:shadow-pop sm:p-6 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <BookMarked className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl font-semibold text-foreground group-hover:text-primary">
            Meu vocabulário
          </h2>
          {hasAny ? (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {counts.words} {counts.words === 1 ? "palavra" : "palavras"} · {counts.phrases}{" "}
              {counts.phrases === 1 ? "frase" : "frases"}
            </p>
          ) : null}
        </div>
      </div>

      {hasAny ? (
        <>
          <div className="mt-4 flex flex-1 items-center gap-4">
            <VocabRing due={due} total={counts.total} />
            <div className="min-w-0">
              <p className="text-sm leading-snug text-muted-foreground">
                {due > 0
                  ? `${due} ${due === 1 ? "item" : "itens"} para revisar hoje`
                  : "Nenhuma revisão pendente agora."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">Itens vencidos do acervo</p>
            </div>
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            Ver vocabulário
            <ArrowUpRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
            Traduza palavras e frases na prática e elas aparecem aqui para estudar depois.
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            Começar a colecionar
            <ArrowUpRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </p>
        </>
      )}
    </Link>
  );
}

/** Cartão da rotina do dia (projeto 13, §4.4.2 / S5): o plano diário é a ação —
 * quantidade e duração da fila efetiva (preview determinístico da Fase 2).
 * Com sessão/simulado em andamento, o clique retoma em vez de sobrescrever. */
function DailyPlanCard() {
  const app = useAppState();
  const navigate = useNavigate();
  const action = useMemo(() => buildHomeDailyAction(app), [app]);
  const resume = useMemo(() => selectHomeResume(app, Date.now()), [app]);

  const start = () => {
    if (resume && (resume.kind === "session" || resume.kind === "exam")) {
      if (resume.kind === "exam") navigate({ to: "/exam" });
      else if (resume.qid) navigate({ to: "/practice", search: { q: resume.qid } });
      else navigate({ to: "/session" });
      return;
    }
    if (!action) return;
    startMixedSession(action.counts, computeStats(app), {
      due: action.dueCounts,
      fresh: action.newCounts,
    });
    const first = sessionNextId();
    if (first) navigate({ to: "/practice", search: { q: first } });
    else navigate({ to: "/session" });
  };

  if (!action) {
    return (
      <Link
        to="/practice"
        className="group flex h-full flex-col rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:shadow-pop focus-visible:shadow-pop sm:p-6 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <CalendarCheck className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-semibold text-foreground group-hover:text-primary">
              Sua rotina de hoje
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sem recomendação por hoje — a meta diária está baixa ou o estoque elegível acabou.
            </p>
          </div>
        </div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          Escolher um treino
          <ArrowUpRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </p>
      </Link>
    );
  }

  const minutes = Math.max(1, Math.round(action.seconds / 60));
  return (
    <button
      type="button"
      onClick={start}
      className="group flex h-full flex-col rounded-2xl border border-primary/20 bg-card bg-glow p-5 text-left shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:shadow-pop focus-visible:shadow-pop sm:p-6 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <CalendarCheck className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl font-semibold text-foreground group-hover:text-primary">
            Sua rotina de hoje
          </h2>
          <p className="mt-1 text-sm font-medium tabular-nums text-foreground">
            Hoje: {action.count} questões, {action.reviews} revisões · ~{minutes} min
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {action.types.map((t) => `${t.label} (${t.count})`).join(" · ")}
          </p>
        </div>
      </div>
      <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        Treinar plano de hoje
        <ArrowUpRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </p>
    </button>
  );
}

function Home() {
  // Alvo de foco pós-navegação/skip link (projeto 13, §0.3).
  const titleRef = usePageFocusTarget<HTMLHeadingElement>();
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
        {/* Hero editorial (projeto 12, S2): 1 protagonista = o título. */}
        <section
          aria-labelledby="page-title"
          className="relative rounded-2xl border border-border/60 bg-card bg-glow p-6 shadow-card sm:p-10"
        >
          <span
            aria-hidden
            className="inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-card"
          >
            <BookA className="size-5.5" strokeWidth={2.25} />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            PTE Academic
          </p>
          <h1
            ref={titleRef}
            id="page-title"
            tabIndex={-1}
            className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-foreground focus:outline-none sm:text-6xl"
          >
            Treine para o PTE com questões reais
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Pratique com correção palavra por palavra e transforme revisão em rotina — sem servidor,
            sem conta, salvo no seu navegador.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {TOTAL_ALL_QUESTIONS_LABEL} questões · {TYPE_COUNT} tipos de tarefa · 4 seções
          </p>
          <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
            <Button asChild size="lg" className="min-h-11">
              <Link to="/practice">Começar a treinar</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="min-h-11">
              <Link to="/exam">Fazer um simulado</Link>
            </Button>
          </div>
        </section>

        <TargetStrip />

        {/* Grid de seções: cartão inteiro clicável via stretched link (sem links aninhados). */}
        <section aria-labelledby="sections-title" className="mt-10">
          <h2 id="sections-title" className="font-serif text-2xl font-semibold tracking-tight">
            Escolha uma habilidade
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Treine uma seção por vez.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {SECTION_ORDER.map((section: Section) => {
              const meta = SECTION_META[section];
              const first = sectionFirstType(section);
              const firstId = first ? firstIdOfType(first) : undefined;
              return (
                <article
                  key={section}
                  className="group relative isolate rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:shadow-pop focus-within:shadow-pop motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none"
                >
                  <div className="flex items-start gap-3">
                    <SectionIcon section={section} />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-xl font-semibold">
                        <Link
                          to={sectionToPath[section]}
                          className={cn(
                            "text-foreground after:absolute after:inset-0 after:rounded-2xl after:content-['']",
                            SECTION_HOVER[section],
                          )}
                        >
                          {meta.label}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                        {sectionCountLabel(section)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {meta.description}
                  </p>
                  <div className="relative z-10 mt-4 flex flex-wrap gap-3 border-t border-border/60 pt-3">
                    <Link
                      to={sectionToPath[section]}
                      className={cn(
                        "inline-flex min-h-11 items-center text-xs font-medium",
                        SECTION_TEXT[section],
                      )}
                    >
                      {SECTION_FOCUS[section]}
                    </Link>
                  </div>
                  {firstId ? (
                    <div className="relative z-10 mt-1">
                      <Link
                        to="/practice"
                        search={{ q: firstId }}
                        className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Praticar a primeira →
                      </Link>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        {/* Rotina de estudo: vocabulário vivo + sessão rápida (decisão S2). */}
        <section
          aria-label="Sua rotina de estudo"
          className="mt-6 grid items-stretch gap-4 sm:grid-cols-2"
        >
          <VocabCard />
          <SessionCard />
        </section>

        <footer className="mt-10 border-t border-border/60 pt-5 text-xs leading-relaxed text-muted-foreground">
          <p>
            Seu progresso é salvo neste navegador. Exporte um backup para levá-lo a outro
            dispositivo —{" "}
            <Link
              to="/settings"
              className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
            >
              Gerenciar backup
            </Link>
            .
          </p>
          <p className="mt-2">Recursos online, quando ativados, podem usar serviços externos.</p>
        </footer>
      </main>
    </div>
  );
}
