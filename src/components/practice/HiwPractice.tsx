import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { gradeHiw, type HiwGrade } from "@/lib/pte/dictation";
import { metaByType, tokenize } from "@/lib/pte";
import type { HiwQuestion } from "@/lib/pte/types";
import { recordAttempt, useAppState } from "@/lib/storage";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { cn } from "@/lib/utils";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { splitSentences } from "@/lib/plus/sentences";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "result";

export function HiwPractice({ question }: { question: HiwQuestion }) {
  const navigate = useNavigate();
  const pool = useMemo(() => metaByType("lst_hiw"), []);
  const synth = useSpeechSynthesis();
  const plus = useAppState().settings.plus;
  const plusAudio = plus.plusAudio;
  const phraseTranslation = plus.phraseTranslation;

  const words = useMemo(() => tokenize(question.text), [question.text]);
  const errorSet = useMemo(() => new Set(question.errorIndexes), [question.errorIndexes]);
  const [clicked, setClicked] = useState<ReadonlySet<number>>(new Set());
  const [phase, setPhase] = useState<Phase>("idle");
  const [grade, setGrade] = useState<HiwGrade | null>(null);
  const [played, setPlayed] = useState(false);
  const recordedRef = useRef(false);

  const toggle = (i: number) => {
    if (phase !== "idle") return;
    setClicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const play = () => {
    if (phase === "idle" && played) return;
    synth.speak(question.audioText || question.transcript, 1);
    setPlayed(true);
  };

  const submit = () => {
    const g = gradeHiw([...clicked], question.errorIndexes);
    setGrade(g);
    setPhase("result");
    if (!recordedRef.current) {
      recordAttempt({
        qid: question.id,
        taskType: "lst_hiw",
        mode: "manual",
        contentScore: null,
        score: g.percent,
        wpm: null,
        durationMs: 0,
        metrics: { hits: g.hits, falsePositives: g.falsePositives, raw: g.raw },
      });
      recordedRef.current = true;
    }
  };

  const retry = () => {
    setPhase("idle");
    setClicked(new Set());
    setGrade(null);
    setPlayed(false);
    recordedRef.current = false;
    synth.cancel();
  };

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;

  const wordClass = (i: number) => {
    if (phase === "idle") {
      return clicked.has(i) ? "bg-primary/25 text-primary" : "hover:bg-secondary";
    }
    const isErr = errorSet.has(i);
    const isClicked = clicked.has(i);
    if (isErr && isClicked) return "text-success underline underline-offset-4";
    if (isErr && !isClicked) return "text-warning underline decoration-dashed underline-offset-4";
    if (!isErr && isClicked) return "text-destructive line-through decoration-destructive/50";
    return "text-foreground/80";
  };

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? "Ouça a gravação e clique nas palavras do texto que não correspondem ao áudio."
          : "Verde: erro destacado corretamente · laranja: erro que faltou · vermelho: falso positivo."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button variant="outline" onClick={play} disabled={played || !synth.supported}>
              {played ? "Já reproduzida" : "Ouvir gravação"}
            </Button>
          ) : null}
          {phase === "idle" ? (
            <Button size="lg" onClick={submit}>
              Corrigir
            </Button>
          ) : null}
          {phase === "result" ? (
            <Button variant="outline" onClick={play} disabled={!synth.supported}>
              Ouvir de novo
            </Button>
          ) : null}
          {phase === "result" ? (
            <Button variant="outline" onClick={retry}>
              Tentar de novo
            </Button>
          ) : null}
          {phase === "result" && nextId ? (
            <Button size="lg" onClick={() => navigate({ to: "/practice", search: { q: nextId } })}>
              Próxima →
            </Button>
          ) : null}
        </>
      }
    >
      {/* Texto clicável */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        {question.prompt ? (
          <p className="mb-4 text-sm italic text-muted-foreground">
            {question.prompt || "Clique nas palavras que diferem do áudio."}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-0.5 gap-y-1.5 font-serif text-[15px] leading-relaxed">
          {words.map((w, i) => (
            <button
              key={`w-${i}`}
              type="button"
              onClick={() => toggle(i)}
              disabled={phase === "result"}
              className={cn(
                // Área de toque expandida (pseudo-elemento) sem inflar a linha do texto.
                "relative rounded px-1 py-0.5 transition-colors after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[''] disabled:cursor-default",
                wordClass(i),
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {phase === "result" ? (
        <PlusPhraseCard
          type="lst_hiw"
          qid={question.id}
          sentences={splitSentences(question.text)}
          enabled={phraseTranslation}
          audioEnabled={plusAudio}
          aiEnabled={plus.aiTranslation}
          questionText={question.audioText || question.transcript}
        />
      ) : null}

      {/* Resultado */}
      {phase === "result" && grade ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-serif text-lg font-semibold text-primary tabular-nums">
                {grade.raw} ponto{grade.raw === 1 ? "" : "s"}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {grade.hits}/{grade.total} erros destacados · {grade.falsePositives} falso
                {grade.falsePositives === 1 ? "" : "s"} positivo
                {grade.falsePositives === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Pontuação = acertos − falsos positivos (mínimo 0).
            </p>
          </div>
          {question.explanation ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Explicação</p>
                <PlusSpeakButton
                  text={question.explanation}
                  enabled={plusAudio}
                  label="ouvir explicação"
                />
              </div>
              <p className="mt-1 text-muted-foreground">{question.explanation}</p>
            </div>
          ) : null}
          {question.trap ? (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
              <p className="font-medium">Armadilha comum</p>
              <p className="mt-1 text-muted-foreground">{question.trap}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </PracticeShell>
  );
}
