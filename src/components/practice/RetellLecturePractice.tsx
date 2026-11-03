import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { metaByType } from "@/lib/pte";
import {
  cleanSpeakingText,
  gradeRetell,
  RL_MAX_RECORD_MS,
  RL_PREP_SECONDS,
} from "@/lib/pte/speaking";
import type { RetellLectureQuestion } from "@/lib/pte/types";
import type { RetellGrade } from "@/lib/pte/speaking";
import { recordAttempt, useAppState } from "@/lib/storage";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { splitSentences } from "@/lib/plus/sentences";
import { speakingTags } from "@/lib/pte/diagnostics";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "listening" | "prep" | "recording" | "result";

/** Motor A — Retell Lecture: palestra 1x → 10s prep → 40s de fala → keywords + fluência. */
export function RetellLecturePractice({ question }: { question: RetellLectureQuestion }) {
  const navigate = useNavigate();
  const pool = useMemo(() => metaByType("retell_lecture"), []);
  const synth = useSpeechSynthesis();
  const recognition = useSpeechRecognition();

  const [phase, setPhase] = useState<Phase>("idle");
  const [prepLeft, setPrepLeft] = useState(RL_PREP_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [grade, setGrade] = useState<RetellGrade | null>(null);
  const [notGradable, setNotGradable] = useState(false);

  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const startedAtRef = useRef(0);
  const recordedRef = useRef(false);

  const lecture = cleanSpeakingText(question.transcript || question.text);
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
    const g = gradeRetell(lecture, transcript, duration, recognition.getStats().pauses);
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
        taskType: "retell_lecture",
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
  }, [question.id, lecture, recognition, synth]);

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

  const playAudio = useCallback(() => {
    setPhase("listening");
    synth.speak(lecture, 1);
  }, [lecture, synth]);

  const start = () => {
    setGrade(null);
    setNotGradable(false);
    setElapsed(0);
    setPrepLeft(RL_PREP_SECONDS);
    recordedRef.current = false;
    recognition.clearError();
    playAudio();
  };

  // Áudio terminou → preparação de 10s
  useEffect(() => {
    if (phase !== "listening" || synth.speaking) return undefined;
    const t = window.setTimeout(() => setPhase("prep"), 300);
    return () => window.clearTimeout(t);
  }, [phase, synth.speaking]);

  // Contagem de preparação
  useEffect(() => {
    if (phase !== "prep") return;
    if (prepLeft <= 0) {
      beginRecording();
      return;
    }
    const t = window.setTimeout(() => setPrepLeft((p) => p - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phase, prepLeft, beginRecording]);

  // Cronômetro + limite de gravação (40s)
  useEffect(() => {
    if (phase !== "recording") return;
    const iv = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
    return () => window.clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase === "recording" && elapsed >= RL_MAX_RECORD_MS) finishRef.current();
  }, [phase, elapsed]);

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;
  const micDenied = recognition.error === "not-allowed" || recognition.error === "network";

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? "Ouça a palestra — ela toca uma única vez."
          : phase === "listening"
            ? "Ouvindo… capture as ideias principais."
            : phase === "prep"
              ? "Organize suas ideias."
              : phase === "recording"
                ? "Reconte a palestra com suas palavras."
                : "Veja quais keywords você cobriu."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button size="lg" onClick={start} disabled={!synth.supported}>
              Ouvir a palestra
            </Button>
          ) : null}
          {phase === "listening" ? (
            <Button size="lg" disabled>
              Reproduzindo…
            </Button>
          ) : null}
          {phase === "prep" ? (
            <>
              <ProgressRing value={1 - prepLeft / RL_PREP_SECONDS} size={56}>
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
                {(Math.max(0, RL_MAX_RECORD_MS - elapsed) / 1000).toFixed(0)}s
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
            text={lecture}
            enabled={wordTranslation}
            aiEnabled={plus.aiTranslation}
            source={{ type: "retell_lecture", qid: question.id }}
            className="text-sm leading-relaxed text-muted-foreground"
          />
        ) : (
          <div className="flex min-h-24 items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              {phase === "listening"
                ? "🔊 Reproduzindo a palestra…"
                : phase === "recording"
                  ? `🎙️ Gravando… ${(elapsed / 1000).toFixed(1)}s`
                  : phase === "prep"
                    ? "Prepare o esqueleto do seu reconto."
                    : "A transcrição aparece aqui depois da sua tentativa."}
            </p>
          </div>
        )}
      </div>

      {phase === "result" ? (
        <PlusPhraseCard
          type="retell_lecture"
          qid={question.id}
          sentences={splitSentences(lecture)}
          enabled={phraseTranslation}
          aiEnabled={plus.aiTranslation}
        />
      ) : null}

      {phase === "result" ? (
        <div className="mt-6 space-y-4">
          {micDenied ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium">Precisamos do microfone para avaliar seu reconto.</p>
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
              <p className="font-medium">Não foi possível avaliar este reconto.</p>
              <p className="mt-1 text-muted-foreground">
                A fala ficou curta demais — fale por pelo menos alguns segundos e tente de novo.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </PracticeShell>
  );
}
