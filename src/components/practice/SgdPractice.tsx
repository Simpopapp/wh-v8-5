import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { metaByType } from "@/lib/pte";
import type { SgdQuestion } from "@/lib/pte/types";
import {
  cleanSpeakingText,
  gradeRetell,
  SGD_MAX_RECORD_MS,
  SGD_PREP_SECONDS,
  type RetellGrade,
} from "@/lib/pte/speaking";
import { recordAttempt, useAppState } from "@/lib/storage";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { speakingTags } from "@/lib/pte/diagnostics";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "playing" | "prep" | "recording" | "result";

interface VoiceTurn {
  text: string;
  rate: number;
  pitch: number;
}

/** Vozes sintéticas por speaker: tom/ritmo levemente distintos (1→grave, 2→agudo, 3→neutro). */
function voiceProfileFor(speaker: string): { rate: number; pitch: number } {
  const n = Number.parseInt(speaker.replace(/\D/g, ""), 10) || 0;
  const profiles = [
    { rate: 0.95, pitch: 0.8 },
    { rate: 1, pitch: 1.3 },
    { rate: 1.05, pitch: 1.0 },
  ];
  return profiles[n > 0 ? (n - 1) % 3 : 0]!;
}

/**
 * Motor Fase 7 — Summarize Group Discussion: discussão entre 3 pessoas (TTS multi-voz,
 * reprodução única) → 10 s de preparo → 2 minutos de fala → keywords + fluência.
 */
export function SgdPractice({ question }: { question: SgdQuestion }) {
  const navigate = useNavigate();
  const pool = useMemo(() => metaByType("summarize_group_discussion"), []);
  const synth = useSpeechSynthesis();
  const recognition = useSpeechRecognition();

  const [phase, setPhase] = useState<Phase>("idle");
  const [turnIdx, setTurnIdx] = useState(-1); // -1 = narração
  const [prepLeft, setPrepLeft] = useState(SGD_PREP_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [grade, setGrade] = useState<RetellGrade | null>(null);
  const [notGradable, setNotGradable] = useState(false);

  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const startedAtRef = useRef(0);
  const recordedRef = useRef(false);

  const discussion = cleanSpeakingText(question.text);
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
    const g = gradeRetell(discussion, transcript, duration, recognition.getStats().pauses);
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
        taskType: "summarize_group_discussion",
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
  }, [question.id, discussion, recognition, synth]);

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

  const playQueue = useCallback(
    (items: VoiceTurn[], idx: number) => {
      if (idx >= items.length) {
        setTurnIdx(-1);
        setPhase("prep");
        setPrepLeft(SGD_PREP_SECONDS);
        return;
      }
      setTurnIdx(idx);
      const it = items[idx]!;
      synth.speak(it.text, it.rate, undefined, {
        pitch: it.pitch,
        onend: () => {
          if (phaseRef.current !== "playing") return;
          playQueue(items, idx + 1);
        },
      });
    },
    [synth],
  );

  const start = () => {
    setGrade(null);
    setNotGradable(false);
    setElapsed(0);
    setTurnIdx(-1);
    recordedRef.current = false;
    recognition.clearError();
    setPhase("playing");
    const narration: VoiceTurn = { text: question.narration, rate: 1, pitch: 1 };
    const turns: VoiceTurn[] = question.turns.map((t) => ({
      text: t.text,
      ...voiceProfileFor(t.speaker),
    }));
    playQueue([narration, ...turns], 0);
  };

  // Contagem de preparação (10 s) após o áudio.
  useEffect(() => {
    if (phase !== "prep") return;
    if (prepLeft <= 0) {
      beginRecording();
      return;
    }
    const t = window.setTimeout(() => setPrepLeft((p) => p - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phase, prepLeft, beginRecording]);

  // Cronômetro + limite de gravação (2 minutos).
  useEffect(() => {
    if (phase !== "recording") return;
    const iv = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
    return () => window.clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase === "recording" && elapsed >= SGD_MAX_RECORD_MS) finishRef.current();
  }, [phase, elapsed]);

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;
  const micDenied = recognition.error === "not-allowed" || recognition.error === "network";
  const totalTurns = question.turns.length;
  const currentTurn = turnIdx >= 0 ? question.turns[turnIdx] : undefined;

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? "Ouça a discussão — ela toca uma única vez, com 3 vozes."
          : phase === "playing"
            ? `Ouvindo… turno ${Math.max(1, turnIdx + 1)} de ${totalTurns}.`
            : phase === "prep"
              ? "Organize o resumo: tópico, ideias principais e quem disse o quê."
              : phase === "recording"
                ? "Resuma a discussão em até 2 minutos."
                : "Veja quais keywords você cobriu."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button size="lg" onClick={start} disabled={!synth.supported}>
              Ouvir a discussão
            </Button>
          ) : null}
          {phase === "playing" ? (
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                synth.cancel();
                setTurnIdx(-1);
                setPhase("prep");
                setPrepLeft(SGD_PREP_SECONDS);
              }}
            >
              Pular áudio
            </Button>
          ) : null}
          {phase === "prep" ? (
            <>
              <ProgressRing value={1 - prepLeft / SGD_PREP_SECONDS} size={56}>
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
                {(Math.max(0, SGD_MAX_RECORD_MS - elapsed) / 1000).toFixed(0)}s
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
          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <PlusWordText
              text={question.narration}
              enabled={wordTranslation}
              aiEnabled={plus.aiTranslation}
              source={{ type: "summarize_group_discussion", qid: question.id }}
              className="font-medium text-foreground"
            />
            {question.turns.map((t, i) => (
              <p key={i} className="flex flex-wrap items-baseline gap-x-1">
                <span className="font-medium text-foreground/80">{t.speaker}:</span>
                <PlusWordText
                  text={t.text}
                  enabled={wordTranslation}
                  aiEnabled={plus.aiTranslation}
                  source={{ type: "summarize_group_discussion", qid: question.id }}
                  inline
                  className="text-muted-foreground"
                />
              </p>
            ))}
          </div>
        ) : (
          <div className="flex min-h-24 flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              {phase === "playing"
                ? `🔊 Reproduzindo a discussão… turno ${Math.max(1, turnIdx + 1)} de ${totalTurns}`
                : phase === "recording"
                  ? `🎙️ Gravando… ${(elapsed / 1000).toFixed(1)}s`
                  : phase === "prep"
                    ? "Anote: tópico, posição de cada speaker e o consenso final."
                    : "A transcrição completa aparece aqui depois da sua tentativa."}
            </p>
            {phase === "playing" && currentTurn ? (
              <p className="mt-3 max-w-md text-xs text-muted-foreground/70">
                {currentTurn.speaker} está falando…
              </p>
            ) : null}
          </div>
        )}
      </div>

      {phase === "result" ? (
        <PlusPhraseCard
          type="summarize_group_discussion"
          qid={question.id}
          sentences={[question.narration, ...question.turns.map((t) => t.text)]}
          enabled={phraseTranslation}
          aiEnabled={plus.aiTranslation}
        />
      ) : null}

      {phase === "result" ? (
        <div className="mt-6 space-y-4">
          {micDenied ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium">Precisamos do microfone para avaliar seu resumo.</p>
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
              <p className="font-medium">Não foi possível avaliar este resumo.</p>
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
