import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Layers,
  ClipboardCheck,
  Mic,
  MicOff,
  PlayCircle,
  Trash2,
} from "lucide-react";

import { ExamRunner } from "@/components/exam/ExamRunner";
import { PageHeader } from "@/components/layout/PageHeader";
import { SECTION_ICONS, SECTION_TEXT } from "@/components/layout/SectionIdentity";
import { TopNav } from "@/components/TopNav";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SECTION_META, SECTION_ORDER } from "@/lib/pte";
import type { Section } from "@/lib/pte/types";
import {
  BLUEPRINT_OMISSIONS,
  estimateSeconds,
  examQuestionCount,
  type ExamId,
} from "@/lib/pte/exam";
import { clearExamDraft, getExamDraft, useAppState, type ExamDraft } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exam")({
  head: () => ({
    meta: [
      { title: "Simulado — PTE Master Hub" },
      {
        name: "description",
        content:
          "Simulado cronometrado do PTE por seção ou completo, com tempos oficiais, auto-submit, retomada e resumo comparativo com sua prática.",
      },
      { property: "og:title", content: "Simulado — PTE Master Hub" },
      {
        property: "og:description",
        content:
          "Simulado cronometrado do PTE por seção ou completo, com tempos oficiais, retomada e resumo comparativo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExamPage,
});

function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `~${m} min`;
  return `~${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min`;
}

/**
 * Fluxo do simulado (projeto 13, §4.4.4 / S7): escolha → pré-início → execução.
 * O relógio só começa com o "Iniciar" da tela de pré-início; retomada de draft
 * segue direto para o runner com o deadline persistido (Fase 1).
 */
type ExamFlow =
  | { screen: "choice" }
  | { screen: "prestart"; examId: ExamId }
  | { screen: "running"; examId: ExamId };

function ExamPage() {
  const app = useAppState();
  const [flow, setFlow] = useState<ExamFlow>({ screen: "choice" });
  const [draft, setDraft] = useState<ExamDraft | null>(null);
  const [draftHandled, setDraftHandled] = useState(false);

  // Detecta um draft retomável (§1.1) — uma única vez por visita.
  useEffect(() => {
    if (draft || draftHandled) return;
    const d = getExamDraft();
    if (d) setDraft(d);
    else setDraftHandled(true);
  }, [draft, draftHandled]);

  if (flow.screen === "prestart") {
    return (
      <ExamPreStartScreen
        examId={flow.examId}
        verifiedOnly={app.settings.verifiedOnly}
        onBack={() => setFlow({ screen: "choice" })}
        onConfirmStart={() => setFlow({ screen: "running", examId: flow.examId })}
      />
    );
  }
  if (flow.screen === "running") {
    return (
      <ExamRunner
        key={flow.examId}
        examId={flow.examId}
        onExit={() => setFlow({ screen: "choice" })}
      />
    );
  }
  return (
    <ChoiceScreen
      verifiedOnly={app.settings.verifiedOnly}
      draft={draft}
      onResumeDraft={() => {
        if (draft) setFlow({ screen: "running", examId: draft.examId });
      }}
      onDiscardDraft={() => {
        clearExamDraft();
        setDraft(null);
        setDraftHandled(true);
      }}
      onStart={(id) => setFlow({ screen: "prestart", examId: id })}
    />
  );
}

function ChoiceScreen({
  verifiedOnly,
  draft,
  onResumeDraft,
  onDiscardDraft,
  onStart,
}: {
  verifiedOnly: boolean;
  draft: ExamDraft | null;
  onResumeDraft: () => void;
  onDiscardDraft: () => void;
  onStart: (id: ExamId) => void;
}) {
  const [pending, setPending] = useState<ExamId | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);

  useEffect(() => {
    if (draft) setResumeOpen(true);
  }, [draft]);

  const modes: { id: ExamId; label: string; description: string }[] = [
    {
      id: "mini",
      label: "Mini-simulado",
      description: "As quatro seções em sequência, com uma amostra curta de cada tipo.",
    },
    {
      id: "full",
      label: "Simulado completo",
      description: "Blueprint oficial de ~2 h, com as contagens e a ordem do exame real.",
    },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <PageHeader
          kicker="Treino cronometrado"
          title="Simulado"
          subtitle="Questões sorteadas com os tempos oficiais do exame. Ao zerar o cronômetro de cada questão, a resposta é enviada — sem correção imediata. No fim, você compara com sua prática livre."
        />

        {draft ? (
          <section
            aria-label="Simulado em andamento"
            className="rounded-2xl border border-primary/40 bg-card bg-glow p-5 shadow-card"
          >
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
              <PlayCircle className="size-5 text-primary" aria-hidden />
              Simulado em andamento
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {examLabelFor(draft.examId)} · {draft.results.length} de {draft.queue.length}{" "}
              questão(ões) respondida(s). Ao retomar, o relógio da questão atual continua de onde
              parou — o tempo longe do app conta.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={onResumeDraft}>Retomar simulado</Button>
              <Button variant="outline" onClick={onDiscardDraft}>
                <Trash2 className="size-4" aria-hidden />
                Descartar progresso
              </Button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {options.map((opt) => {
            const Icon = opt.section
              ? SECTION_ICONS[opt.section]
              : opt.id === "mini"
                ? Layers
                : ClipboardCheck;
            const eligible = examQuestionCount(opt.id, { verifiedOnly });
            const full = examQuestionCount(opt.id);
            return (
              <Button
                key={opt.id}
                type="button"
                variant="outline"
                onClick={() => {
                  if (draft) {
                    // Um simulado novo sobrescreve o draft salvo — confirmar.
                    setPending(opt.id);
                    return;
                  }
                  onStart(opt.id);
                }}
                className="h-auto min-h-32 w-full min-w-0 items-start justify-start whitespace-normal rounded-2xl border-border/60 bg-card p-5 text-left shadow-card transition-colors duration-200 ease-out hover:border-primary/50 motion-reduce:transition-none"
              >
                <span className="flex w-full items-start gap-3 text-left">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                  >
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-lg font-semibold text-foreground">
                      {opt.label}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                      {opt.description}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden />
                      {eligible} questões · {fmtDuration(estimateSeconds(opt.id, { verifiedOnly }))}
                      {eligible < full ? " · filtro de fontes ativo" : ""}
                    </span>
                  </span>
                </span>
              </Button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          As tentativas do simulado alimentam sua agenda de revisão, mas ficam marcadas como exame e
          não entram na sua média de prática.
        </p>

        <p className="text-xs text-muted-foreground">
          Blueprint oficial: {BLUEPRINT_OMISSIONS.join("; ")}.
        </p>

        <Button variant="ghost" className="min-h-11" onClick={() => history.back()}>
          Voltar
        </Button>

        {/* Recusa do draft: mantém o progresso salvo para a próxima visita. */}
        <AlertDialog
          open={draft !== null && resumeOpen}
          onOpenChange={(open) => setResumeOpen(open)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retomar simulado em andamento?</AlertDialogTitle>
              <AlertDialogDescription>
                Você tem um {examLabelFor(draft?.examId ?? "mini")} incompleto (
                {draft?.results.length ?? 0} de {draft?.queue.length ?? 0} respondidas). Retomar
                continua do ponto onde parou; iniciar outro simulado descarta esse progresso.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Escolher depois</AlertDialogCancel>
              <AlertDialogAction
                className="border border-border bg-background text-foreground hover:bg-secondary hover:text-secondary-foreground"
                onClick={onDiscardDraft}
              >
                Descartar progresso
              </AlertDialogAction>
              <AlertDialogAction onClick={onResumeDraft}>Retomar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Início de simulado novo com draft salvo: confirmação explícita. */}
        <AlertDialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Iniciar novo simulado?</AlertDialogTitle>
              <AlertDialogDescription>
                Existe um {examLabelFor(draft?.examId ?? "mini")} incompleto salvo. Iniciar{" "}
                {pending ? examLabelFor(pending) : "outro simulado"} agora descarta esse progresso —
                não será possível desfazer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Manter progresso</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pending) {
                    onDiscardDraft();
                    onStart(pending);
                  }
                  setPending(null);
                }}
              >
                Descartar e iniciar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}

function examLabelFor(id: ExamId): string {
  if (id === "mini") return "mini-simulado";
  if (id === "full") return "simulado completo";
  return SECTION_META[id as Section]?.label ?? "simulado";
}
