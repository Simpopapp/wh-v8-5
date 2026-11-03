import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { metaByType } from "@/lib/pte";
import type { DescribeImageQuestion } from "@/lib/pte/types";
import {
  gradeRetell,
  DI_MAX_RECORD_MS,
  DI_PREP_SECONDS,
  type RetellGrade,
} from "@/lib/pte/speaking";
import { DESCRIBE_IMAGE_ASSETS, DI_SOURCE_LABEL } from "@/lib/pte/describeImageAssets";
import { recordAttempt } from "@/lib/storage";
import { speakingTags } from "@/lib/pte/diagnostics";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { PracticeShell } from "./PracticeShell";

type Phase = "prep" | "recording" | "result";

/**
 * Motor Fase 7 — Describe Image: gráfico visível → 25 s de estudo/preparo →
 * 40 s de fala → correção contra as keywords da descrição de referência
 * (verificada contra os dados do próprio gráfico).
 */
export function DescribeImagePractice({ question }: { question: DescribeImageQuestion }) {
  const navigate = useNavigate();
  const pool = useMemo(() => metaByType("describe_image"), []);
  const recognition = useSpeechRecognition();

  const [phase, setPhase] = useState<Phase>("prep");
  const [prepLeft, setPrepLeft] = useState(DI_PREP_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [grade, setGrade] = useState<RetellGrade | null>(null);
  const [notGradable, setNotGradable] = useState(false);

  const phaseRef = useRef<Phase>("prep");
  phaseRef.current = phase;
  const startedAtRef = useRef(0);
  const recordedRef = useRef(false);

  const image = DESCRIBE_IMAGE_ASSETS[question.image];

  const finish = useCallback(() => {
    if (phaseRef.current !== "recording") return;
    recognition.stop();
    const duration = Date.now() - startedAtRef.current;
    const micDenied = recognition.error === "not-allowed" || recognition.error === "network";
    if (micDenied || !recognition.supported) {
      setGrade(null);
      setNotGradable(true);
      setPhase("result");
      return;
    }
    const transcript = recognition.getTranscript();
    const g = gradeRetell(question.text, transcript, duration, recognition.getStats().pauses);
    if (!g.gradable) {
      setGrade(null);
      setNotGradable(true);
      setPhase("result");
      return;
    }
    setGrade(g);
    setNotGradable(false);
    if (!recordedRef.current) {
      recordAttempt({
        qid: question.id,
        taskType: "describe_image",
        mode: "speech",
        contentScore: g.coverage,
        score: g.score,
        wpm: g.wpm,
        durationMs: duration,
        metrics: {
          coverage: g.coverage,
          pauses: g.pauses,
          repetitions: g.repetitions,
          total: 12,
          hits: Math.round((g.coverage / 100) * 12),
        },
        tags: speakingTags(
          g.score,
          { hits: Math.round((g.coverage / 100) * 12), total: 12 },
          g.wpm,
        ),
      });
      recordedRef.current = true;
    }
    setPhase("result");
  }, [question.id, question.text, recognition]);

  const finishRef = useRef(finish);
  finishRef.current = finish;

  const beginRecording = useCallback(() => {
    setPhase("recording");
    startedAtRef.current = Date.now();
    setElapsed(0);
    if (recognition.supported) {
      recognition.start({ onSilence: () => finishRef.current() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognition.supported]);

  // A imagem fica visível do início ao fim (como na prova); 25 s de preparo.
  useEffect(() => {
    if (phase !== "prep") return;
    if (prepLeft <= 0) {
      beginRecording();
      return;
    }
    const t = window.setTimeout(() => setPrepLeft((p) => p - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phase, prepLeft, beginRecording]);

  useEffect(() => {
    if (phase !== "recording") return;
    const iv = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
    return () => window.clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase === "recording" && elapsed >= DI_MAX_RECORD_MS) finishRef.current();
  }, [phase, elapsed]);

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;
  const micDenied = recognition.error === "not-allowed" || recognition.error === "network";

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "prep"
          ? "Estude o gráfico — introdução, eixos, tendência e destaque."
          : phase === "recording"
            ? "Descreva o gráfico em até 40 segundos."
            : "Compare com a descrição de referência."
      }
      footerActions={
        <>
          {phase === "prep" ? (
            <>
              <ProgressRing value={1 - prepLeft / DI_PREP_SECONDS} size={56}>
                <span className="font-serif text-lg font-semibold tabular-nums">
                  {Math.max(0, prepLeft)}
                </span>
              </ProgressRing>
              <Button size="lg" onClick={beginRecording}>
                Começar a falar
              </Button>
            </>
          ) : null}
          {phase === "recording" ? (
            <>
              <span className="font-serif text-sm tabular-nums text-muted-foreground">
                {(Math.max(0, DI_MAX_RECORD_MS - elapsed) / 1000).toFixed(0)}s
              </span>
              <Button size="lg" variant="destructive" onClick={() => finishRef.current()}>
                Encerrar e corrigir
              </Button>
            </>
          ) : null}
          {phase === "result" ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setGrade(null);
                  setNotGradable(false);
                  setElapsed(0);
                  setPrepLeft(DI_PREP_SECONDS);
                  recordedRef.current = false;
                  recognition.clearError();
                  setPhase("prep");
                }}
              >
                Tentar de novo
              </Button>
              {nextId ? (
                <Button
                  size="lg"
                  onClick={() => navigate({ to: "/practice", search: { q: nextId } })}
                >
                  Próxima →
                </Button>
              ) : null}
            </>
          ) : null}
        </>
      }
    >
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        {question.prompt ? (
          <p className="mb-4 text-sm italic text-muted-foreground">{question.prompt}</p>
        ) : null}
        <figure className="space-y-3">
          {image ? (
            <img
              src={image}
              alt={question.alt}
              className="mx-auto max-h-[420px] w-auto max-w-full rounded-xl border border-border bg-background p-2"
              loading="lazy"
            />
          ) : (
            <p className="text-sm text-destructive">Imagem indisponível para este item.</p>
          )}
          <figcaption className="text-xs text-muted-foreground">
            {question.topic} · Fonte: {DI_SOURCE_LABEL}
          </figcaption>
        </figure>
        {phase === "recording" ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            🎙️ Gravando… {(elapsed / 1000).toFixed(1)}s
          </p>
        ) : null}
      </div>

      {phase === "result" ? (
        <div className="mt-6 space-y-4">
          {micDenied ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium">Precisamos do microfone para avaliar sua descrição.</p>
              <p className="mt-1 text-muted-foreground">
                Libere o acesso no ícone de cadeado da barra de endereço e tente de novo.
              </p>
            </div>
          ) : null}
          {grade ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                  <div className="font-serif text-2xl font-semibold">{grade.score}</div>
                  <div className="text-xs text-muted-foreground">score</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                  <div className="font-serif text-2xl font-semibold">{grade.coverage}%</div>
                  <div className="text-xs text-muted-foreground">keywords</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                  <div className="font-serif text-2xl font-semibold">{grade.wpm}</div>
                  <div className="text-xs text-muted-foreground">wpm</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                  <div className="font-serif text-2xl font-semibold">{grade.pauses}</div>
                  <div className="text-xs text-muted-foreground">pausas</div>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
                <p className="font-medium">Keywords cobertas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {grade.covered.map((k) => (
                    <span
                      key={k}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
                    >
                      {k}
                    </span>
                  ))}
                  {grade.covered.length === 0 ? (
                    <span className="text-muted-foreground">Nenhuma 🙁</span>
                  ) : null}
                </div>
                {grade.missed.length > 0 ? (
                  <>
                    <p className="mt-4 font-medium">Faltaram</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {grade.missed.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
              {grade.transcript ? (
                <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
                  <p className="font-medium">Sua fala</p>
                  <p className="mt-2 text-muted-foreground">{grade.transcript}</p>
                </div>
              ) : null}
            </>
          ) : null}
          {notGradable && !micDenied ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <p className="font-medium">Não foi possível avaliar esta descrição.</p>
              <p className="mt-1 text-muted-foreground">
                A fala ficou curta demais — fale por pelo menos alguns segundos e tente de novo.
              </p>
            </div>
          ) : null}
          <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
            <p className="font-medium">Descrição de referência</p>
            <p className="mt-1 font-serif leading-relaxed text-muted-foreground">{question.text}</p>
          </div>
        </div>
      ) : null}
    </PracticeShell>
  );
}
