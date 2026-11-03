import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { PassageText } from "@/components/PassageText";
import { ProgressRing } from "@/components/ProgressRing";
import { ScorePanel } from "@/components/ScorePanel";
import { Button } from "@/components/ui/button";
import { metaByType } from "@/lib/pte";
import {
  cleanSpeakingText,
  gradeRepeatSentence,
  RS_MAX_RECORD_MS,
  RS_PREP_SECONDS,
} from "@/lib/pte/speaking";
import type { RepeatSentenceQuestion } from "@/lib/pte/types";
import type { GradeResult } from "@/lib/scoring";
import { recordAttempt } from "@/lib/storage";
import { useAppState } from "@/lib/storage";
import { speakingTags } from "@/lib/pte/diagnostics";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "listening" | "prep" | "recording" | "result";

/** Motor A — Repeat Sentence: áudio 1x → 3s → repetição gravada → alinhamento exato. */
export function RepeatSentencePractice({ question }: { question: RepeatSentenceQuestion }) {
  const navigate = useNavigate();
  const pool = useMemo(() => metaByType("repeat_sentence"), []);
  const synth = useSpeechSynthesis();
  const recognition = useSpeechRecognition();
  const plus = useAppState().settings.plus;
  const plusAudio = plus.plusAudio;
  const wordTranslation = plus.wordTranslation;
  const phraseTranslation = plus.phraseTranslation;

  const [phase, setPhase] = useState<Phase>("idle");
  const [prepLeft, setPrepLeft] = useState(RS_PREP_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [notGradable, setNotGradable] = useState(false);

  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const startedAtRef = useRef(0);
  const recordedRef = useRef(false);

  const reference = cleanSpeakingText(question.answer || question.transcript || question.text);
  const referenceWords = useMemo(() => reference.split(/\s+/).filter(Boolean), [reference]);

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
    const g = gradeRepeatSentence(reference, transcript, duration, recognition.getStats().pauses);
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
        taskType: "repeat_sentence",
        mode: "speech",
        contentScore: g.score,
        score: g.score,
        wpm: g.wpm,
        durationMs: duration,
        metrics: {
          hits: g.hits,
          missed: g.total - g.hits,
          extras: g.extras.length,
          total: g.total,
        },
        tags: speakingTags(g.score, { hits: g.hits, total: g.total }, g.wpm),
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

  const playAudio = useCallback(() => {
    setPhase("listening");
    synth.speak(reference, 1);
  }, [reference, synth]);

  const start = () => {
    setGrade(null);
    setNotGradable(false);
    setElapsed(0);
    setPrepLeft(RS_PREP_SECONDS);
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
    if (phase === "recording" && elapsed >= RS_MAX_RECORD_MS) finishRef.current();
  }, [phase, elapsed]);

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;
  const micDenied = recognition.error === "not-allowed" || recognition.error === "network";

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? "Ouça a frase com atenção — ela toca uma única vez."
          : phase === "listening"
            ? "Ouvindo… memorize a frase."
            : phase === "prep"
              ? "Prepare-se para repetir."
              : phase === "recording"
                ? "Repita exatamente o que ouviu."
                : "Compare o resultado palavra a palavra."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button size="lg" onClick={start} disabled={!synth.supported}>
              Ouvir e repetir
            </Button>
          ) : null}
          {phase === "listening" ? (
            <Button size="lg" disabled>
              Reproduzindo…
            </Button>
          ) : null}
          {phase === "prep" ? (
            <>
              <ProgressRing value={1 - prepLeft / RS_PREP_SECONDS} size={56}>
                <span className="font-serif text-lg font-semibold tabular-nums">
                  {Math.max(0, prepLeft)}
                </span>
              </ProgressRing>
              <Button size="lg" onClick={beginRecording}>
                Falar agora
              </Button>
            </>
          ) : null}
          {phase === "recording" ? (
            <Button size="lg" variant="destructive" onClick={() => finishRef.current()}>
              Parar e corrigir
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
      {/* Frase só aparece no resultado — no exame real você não lê a frase */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        {question.prompt ? (
          <p className="mb-4 text-sm italic text-muted-foreground">{question.prompt}</p>
        ) : null}
        {phase === "result" ? (
          <>
            {wordTranslation ? (
              <PlusWordText
                text={reference}
                enabled
                aiEnabled={plus.aiTranslation}
                source={{ type: "repeat_sentence", qid: question.id }}
              />
            ) : (
              <PassageText words={referenceWords} marks={grade ? grade.marks : undefined} />
            )}
            <div className="mt-3">
              <PlusSpeakButton text={reference} enabled={plusAudio} label="ouvir frase modelo" />
            </div>
            <PlusPhraseCard
              type="repeat_sentence"
              qid={question.id}
              sentences={[reference]}
              enabled={phraseTranslation}
              audioEnabled={plusAudio}
              aiEnabled={plus.aiTranslation}
            />
          </>
        ) : (
          <div className="flex min-h-24 items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              {phase === "listening"
                ? "🔊 Reproduzindo a frase…"
                : phase === "recording"
                  ? `Gravando… ${(elapsed / 1000).toFixed(1)}s`
                  : "A frase aparece aqui depois da sua tentativa."}
            </p>
          </div>
        )}
      </div>

      {/* Resultado */}
      {phase === "result" ? (
        <div className="mt-6 space-y-4">
          {micDenied ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium">Precisamos do microfone para corrigir sua repetição.</p>
              <p className="mt-1 text-muted-foreground">
                Libere o acesso no ícone de cadeado da barra de endereço e tente de novo.
              </p>
            </div>
          ) : null}
          {grade ? <ScorePanel grade={grade} /> : null}
          {notGradable && !micDenied ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <p className="font-medium">Não foi possível avaliar esta repetição.</p>
              <p className="mt-1 text-muted-foreground">
                A transcrição ficou curta demais — fale mais perto do microfone e tente de novo.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </PracticeShell>
  );
}
