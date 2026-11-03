import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { metaByType } from "@/lib/pte";
import type { RespondSituationQuestion } from "@/lib/pte/types";
import {
  gradeRetell,
  RTS_MAX_RECORD_MS,
  RTS_PREP_SECONDS,
  type RetellGrade,
} from "@/lib/pte/speaking";
import { recordAttempt, useAppState } from "@/lib/storage";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { speakingTags } from "@/lib/pte/diagnostics";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "listening" | "prep" | "recording" | "result";

/**
 * Motor Fase 7 — Respond to a Situation: situação (áudio 1x, como na prova) →
 * 10 s de preparo → 40 s de fala → correção contra as keywords da resposta modelo.
 */
export function RespondSituationPractice({ question }: { question: RespondSituationQuestion }) {
  const navigate = useNavigate();
  const pool = useMemo(() => metaByType("respond_to_situation"), []);
  const synth = useSpeechSynthesis();
  const recognition = useSpeechRecognition();

  const [phase, setPhase] = useState<Phase>("idle");
  const [prepLeft, setPrepLeft] = useState(RTS_PREP_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [grade, setGrade] = useState<RetellGrade | null>(null);
  const [notGradable, setNotGradable] = useState(false);

  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const startedAtRef = useRef(0);
  const recordedRef = useRef(false);

  // A resposta modelo concentra os pontos-chave que a fala precisa cobrir.
  const reference = question.sample || question.text;
  const plus = useAppState().settings.plus;
  const wordTranslation = plus.wordTranslation;
  const phraseTranslation = plus.phraseTranslation;

  const finish = useCallback(() => {
    if (phaseRef.current !== "recording") return;
    recognition.stop();
    synth.cancel();
    const duration = Date.now() - startedAtRef.current;
    const micDenied = recognition.error === "not-allowed" || recognition.error === "network";
    if (micDenied || !recognition.supported) {
      setGrade(null);
      setNotGradable(true);
      setPhase("result");
      return;
    }
    const transcript = recognition.getTranscript();
    const g = gradeRetell(reference, transcript, duration, recognition.getStats().pauses);
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
        taskType: "respond_to_situation",
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
  }, [question.id, reference, recognition, synth]);

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

  const start = () => {
    setGrade(null);
    setNotGradable(false);
    setElapsed(0);
    setPrepLeft(RTS_PREP_SECONDS);
    recordedRef.current = false;
    recognition.clearError();
    setPhase("listening");
    synth.speak(question.text, 1);
  };

  // Áudio terminou → preparação de 10 s (a situação NÃO fica visível, como na prova).
  useEffect(() => {
    if (phase !== "listening" || synth.speaking) return undefined;
    const t = window.setTimeout(() => setPhase("prep"), 300);
    return () => window.clearTimeout(t);
  }, [phase, synth.speaking]);

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
    if (phase === "recording" && elapsed >= RTS_MAX_RECORD_MS) finishRef.current();
  }, [phase, elapsed]);

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;
  const micDenied = recognition.error === "not-allowed" || recognition.error === "network";

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? "Ouça a situação — ela toca uma única vez."
          : phase === "listening"
            ? "Ouvindo… memorize os pontos-chave."
            : phase === "prep"
              ? "Organize a resposta: quem, o que pediu e o que você vai dizer."
              : phase === "recording"
                ? "Responda como se estivesse na situação."
                : "Compare com a resposta modelo."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button size="lg" onClick={start} disabled={!synth.supported}>
              Ouvir a situação
            </Button>
          ) : null}
          {phase === "listening" ? (
            <Button size="lg" disabled>
              Reproduzindo…
            </Button>
          ) : null}
          {phase === "prep" ? (
            <>
              <ProgressRing value={1 - prepLeft / RTS_PREP_SECONDS} size={56}>
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
                {(Math.max(0, RTS_MAX_RECORD_MS - elapsed) / 1000).toFixed(0)}s
              </span>
              <Button size="lg" variant="destructive" onClick={() => finishRef.current()}>
                Encerrar e corrigir
              </Button>
            </>
          ) : null}
          {phase === "result" ? (
            <>
              <Button variant="outline" onClick={start}>
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
        {phase === "result" ? (
          <PlusWordText
            text={question.text}
            enabled={wordTranslation}
            aiEnabled={plus.aiTranslation}
            source={{ type: "respond_to_situation", qid: question.id }}
            className="text-sm leading-relaxed text-muted-foreground"
          />
        ) : (
          <div className="flex min-h-24 items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              {phase === "listening"
                ? "🔊 Reproduzindo a situação…"
                : phase === "recording"
                  ? `🎙️ Gravando… ${(elapsed / 1000).toFixed(1)}s`
                  : phase === "prep"
                    ? "Prepare sua resposta: abertura adequada + todos os pontos da situação."
                    : "A situação aparece aqui depois da sua tentativa."}
            </p>
          </div>
        )}
      </div>

      {phase === "result" ? (
        <PlusPhraseCard
          type="respond_to_situation"
          qid={question.id}
          sentences={[question.text]}
          enabled={phraseTranslation}
          aiEnabled={plus.aiTranslation}
        />
      ) : null}

      {phase === "result" ? (
        <div className="mt-6 space-y-4">
          {micDenied ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium">Precisamos do microfone para avaliar sua resposta.</p>
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
              <p className="font-medium">Não foi possível avaliar esta resposta.</p>
              <p className="mt-1 text-muted-foreground">
                A fala ficou curta demais — fale por pelo menos alguns segundos e tente de novo.
              </p>
            </div>
          ) : null}
          {question.sample ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <p className="font-medium">Resposta modelo</p>
              <p className="mt-1 font-serif leading-relaxed text-muted-foreground">
                {question.sample}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </PracticeShell>
  );
}
