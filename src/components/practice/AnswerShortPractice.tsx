import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { metaByType } from "@/lib/pte";
import {
  cleanSpeakingText,
  gradeAnswerShort,
  ASQ_MAX_RECORD_MS,
  ASQ_PREP_SECONDS,
} from "@/lib/pte/speaking";
import type { AnswerShortQuestion } from "@/lib/pte/types";
import type { ShortAnswerGrade } from "@/lib/pte/speaking";
import { recordAttempt, useAppState } from "@/lib/storage";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "listening" | "prep" | "recording" | "result";

/** Motor A — Answer Short Question: pergunta 1x → 3s → resposta oral curta → matching. */
export function AnswerShortPractice({ question }: { question: AnswerShortQuestion }) {
  const navigate = useNavigate();
  const pool = useMemo(() => metaByType("answer_short"), []);
  const synth = useSpeechSynthesis();
  const recognition = useSpeechRecognition();
  const plus = useAppState().settings.plus;
  const plusAudio = plus.plusAudio;
  const wordTranslation = plus.wordTranslation;
  const phraseTranslation = plus.phraseTranslation;

  const [phase, setPhase] = useState<Phase>("idle");
  const [prepLeft, setPrepLeft] = useState(ASQ_PREP_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [grade, setGrade] = useState<ShortAnswerGrade | null>(null);
  const [notGradable, setNotGradable] = useState(false);

  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const startedAtRef = useRef(0);
  const recordedRef = useRef(false);

  const questionText = cleanSpeakingText(question.audioText || question.text);

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
    const g = gradeAnswerShort(question.answer, transcript);
    if (!g.correct) {
      setGrade(g);
      setNotGradable(transcript.length === 0);
      setPhase("result");
      if (!recordedRef.current) {
        recordAttempt({
          qid: question.id,
          taskType: "answer_short",
          mode: "speech",
          contentScore: 0,
          score: 0,
          durationMs: duration,
          metrics: { correct: 0 },
        });
        recordedRef.current = true;
      }
      return;
    }
    setGrade(g);
    setNotGradable(false);
    if (!recordedRef.current) {
      recordAttempt({
        qid: question.id,
        taskType: "answer_short",
        mode: "speech",
        contentScore: g.score,
        score: g.score,
        durationMs: duration,
        metrics: { correct: 1 },
      });
      recordedRef.current = true;
    }
    setPhase("result");
  }, [question.id, question.answer, recognition, synth]);

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
    synth.speak(questionText, 1);
  }, [questionText, synth]);

  const start = () => {
    setGrade(null);
    setNotGradable(false);
    setElapsed(0);
    setPrepLeft(ASQ_PREP_SECONDS);
    recordedRef.current = false;
    recognition.clearError();
    playAudio();
  };

  // Áudio terminou → contagem de 3s
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

  // Cronômetro + limite máximo de gravação
  useEffect(() => {
    if (phase !== "recording") return;
    const iv = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
    return () => window.clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase === "recording" && elapsed >= ASQ_MAX_RECORD_MS) finishRef.current();
  }, [phase, elapsed]);

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;
  const micDenied = recognition.error === "not-allowed" || recognition.error === "network";

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? "Ouça a pergunta — ela toca uma única vez."
          : phase === "listening"
            ? "Ouvindo…"
            : phase === "prep"
              ? "Prepare a resposta."
              : phase === "recording"
                ? "Responda em uma palavra ou frase curta."
                : "Veja a resposta aceita."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button size="lg" onClick={start} disabled={!synth.supported}>
              Ouvir e responder
            </Button>
          ) : null}
          {phase === "listening" ? (
            <Button size="lg" disabled>
              Reproduzindo…
            </Button>
          ) : null}
          {phase === "prep" ? (
            <>
              <ProgressRing value={1 - prepLeft / ASQ_PREP_SECONDS} size={56}>
                <span className="font-serif text-lg font-semibold tabular-nums">
                  {Math.max(0, prepLeft)}
                </span>
              </ProgressRing>
              <Button size="lg" onClick={beginRecording}>
                Responder agora
              </Button>
            </>
          ) : null}
          {phase === "recording" ? (
            <Button size="lg" variant="destructive" onClick={() => finishRef.current()}>
              Enviar resposta
            </Button>
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
            source={{ type: "answer_short", qid: question.id }}
            className="text-sm leading-relaxed text-foreground"
          />
        ) : (
          <div className="flex min-h-24 items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              {phase === "listening"
                ? "🔊 Reproduzindo a pergunta…"
                : phase === "recording"
                  ? `🎙️ Gravando… ${(elapsed / 1000).toFixed(1)}s`
                  : "A pergunta aparece aqui depois da sua tentativa."}
            </p>
          </div>
        )}
      </div>

      {phase === "result" ? (
        <PlusPhraseCard
          type="answer_short"
          qid={question.id}
          sentences={[question.text]}
          enabled={phraseTranslation}
          audioEnabled={plusAudio}
          aiEnabled={plus.aiTranslation}
        />
      ) : null}

      {phase === "result" ? (
        <div className="mt-6 space-y-4">
          {micDenied ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium">Precisamos do microfone para ouvir sua resposta.</p>
              <p className="mt-1 text-muted-foreground">
                Libere o acesso no ícone de cadeado da barra de endereço e tente de novo.
              </p>
            </div>
          ) : null}
          {grade ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <p className="font-medium">
                {grade.correct ? "✅ Resposta aceita" : "❌ Resposta não reconhecida"}
              </p>
              <p className="mt-2 text-muted-foreground">Aceito: {grade.alternatives.join(" · ")}</p>
              {question.answer ? (
                <div className="mt-2">
                  <PlusSpeakButton
                    text={question.answer}
                    enabled={plusAudio}
                    label="ouvir resposta"
                  />
                </div>
              ) : null}
              {grade.transcript ? (
                <p className="mt-1 text-muted-foreground">Você disse: “{grade.transcript}”</p>
              ) : null}
            </div>
          ) : null}
          {notGradable && !micDenied ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <p className="font-medium">Nada foi reconhecido.</p>
              <p className="mt-1 text-muted-foreground">
                Fale mais perto do microfone e tente de novo.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </PracticeShell>
  );
}
