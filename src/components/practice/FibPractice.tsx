import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { gradeFib, parseFibSegments, type FibGrade } from "@/lib/pte/dictation";
import { metaByType } from "@/lib/pte";
import type { FibQuestion } from "@/lib/pte/types";
import { recordAttempt, useAppState } from "@/lib/storage";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { cn } from "@/lib/utils";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "result";

export function FibPractice({ question }: { question: FibQuestion }) {
  const navigate = useNavigate();
  const pool = useMemo(() => metaByType("lst_fib"), []);
  const synth = useSpeechSynthesis();
  const plus = useAppState().settings.plus;
  const plusAudio = plus.plusAudio;
  const wordTranslation = plus.wordTranslation;

  const segments = useMemo(() => parseFibSegments(question.text), [question.text]);
  const answerCount = question.answers.length;
  const [inputs, setInputs] = useState<string[]>(() => new Array<string>(answerCount).fill(""));
  const [phase, setPhase] = useState<Phase>("idle");
  const [grade, setGrade] = useState<FibGrade | null>(null);
  const [played, setPlayed] = useState(false);
  const recordedRef = useRef(false);

  const setInput = (index: number, value: string) => {
    setInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const play = () => {
    if (phase === "idle" && played) return;
    synth.speak(question.transcript, 1);
    setPlayed(true);
  };

  const submit = () => {
    const g = gradeFib(question.answers, inputs);
    setGrade(g);
    setPhase("result");
    if (!recordedRef.current) {
      recordAttempt({
        qid: question.id,
        taskType: "lst_fib",
        mode: "manual",
        contentScore: null,
        score: g.score,
        wpm: null,
        durationMs: 0,
        metrics: { correct: g.correct, total: g.total },
      });
      recordedRef.current = true;
    }
  };

  const retry = () => {
    setPhase("idle");
    setInputs(new Array<string>(answerCount).fill(""));
    setGrade(null);
    setPlayed(false);
    recordedRef.current = false;
    synth.cancel();
  };

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;
  const audioText = question.audioText || question.transcript;

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? "Ouça a gravação uma vez e preencha as lacunas (Tab avança entre elas)."
          : "Compare o que digitou com a resposta correta em cada lacuna."
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
      {/* Texto lacunado */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        {question.prompt ? (
          <p className="mb-4 text-sm italic text-muted-foreground">{question.prompt}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 font-serif text-[15px] leading-relaxed">
          {segments.map((seg, k) => {
            if (seg.kind === "text" || seg.index >= answerCount) {
              if (seg.kind === "text") {
                return (
                  <PlusWordText
                    key={`t-${k}`}
                    text={seg.word}
                    enabled={wordTranslation}
                    audioEnabled={plusAudio}
                    aiEnabled={plus.aiTranslation}
                    source={{ type: "lst_fib", qid: question.id }}
                    inline
                  />
                );
              }
              return (
                <span key={`t-${k}`} className="text-foreground/90">
                  {"_"}
                </span>
              );
            }
            const result = grade?.blanks[seg.index];
            return (
              <span key={`b-${seg.index}`} className="inline-flex items-center gap-0.5">
                {seg.before ? <span className="text-foreground/90">{seg.before}</span> : null}
                <input
                  value={inputs[seg.index] ?? ""}
                  onChange={(e) => setInput(seg.index, e.target.value)}
                  disabled={phase === "result"}
                  style={{
                    width: `${Math.max(6, (question.answers[seg.index]?.length ?? 5) + 3)}ch`,
                  }}
                  aria-label={`Lacuna ${seg.index + 1}`}
                  placeholder={`lacuna ${seg.index + 1}`}
                  className={cn(
                    "min-h-[44px] rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-80",
                    result
                      ? result.correct
                        ? "border-success text-success"
                        : "border-destructive text-destructive"
                      : "border-input",
                  )}
                />
                {seg.after ? <span className="text-foreground/90">{seg.after}</span> : null}
              </span>
            );
          })}
        </div>
      </div>

      {/* Resultado */}
      {phase === "result" && grade ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-serif text-lg font-semibold text-primary tabular-nums">
                {grade.score}%
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {grade.correct}/{grade.total} lacuna{grade.total === 1 ? "" : "s"} correta
                {grade.correct === 1 && grade.total === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {grade.blanks.map((b, i) => (
                <li key={`r-${i}`} className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      b.correct
                        ? "bg-success/15 text-success"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {b.correct ? "✓ acertou" : "✗ errou"}
                  </span>
                  <span className="text-muted-foreground">
                    você: <span className="text-foreground">{b.typed.trim() || "—"}</span> ·
                    correto: <span className="font-medium text-foreground">{b.answer}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {question.explanation || question.trap ? (
            <div className="space-y-3">
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
        </div>
      ) : null}
    </PracticeShell>
  );
}
