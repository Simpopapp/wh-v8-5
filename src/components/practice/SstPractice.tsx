import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { metaByType, tokenize } from "@/lib/pte";
import type { SstQuestion, SummaryChoiceQuestion } from "@/lib/pte/types";
import {
  gradeSst,
  SST_MAX_WORDS,
  SST_MIN_WORDS,
  SST_NEAR_MAX,
  SST_NEAR_MIN,
  SST_TOTAL_SECONDS,
  type SummaryGrade,
  wordZoneOf,
} from "@/lib/pte/summary";
import { recordAttempt, useAppState } from "@/lib/storage";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { cn } from "@/lib/utils";
import { detectTemplate, type TemplateVerdict } from "@/lib/pte/templateDetector";
import { TemplateWarning } from "@/components/TemplateWarning";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { splitSentences } from "@/lib/plus/sentences";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "playing" | "writing" | "result";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Motor compartilhado por Summarize Spoken Text e Summarize the Audio (lst_summary). */
export function SstPractice({ question }: { question: SstQuestion | SummaryChoiceQuestion }) {
  const navigate = useNavigate();
  const plus = useAppState().settings.plus;
  const wordTranslation = plus.wordTranslation;
  const phraseTranslation = plus.phraseTranslation;
  const plusAudio = plus.plusAudio;
  const pool = useMemo(() => metaByType(question.taskType), [question.taskType]);
  const synth = useSpeechSynthesis();

  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState("");
  const [grade, setGrade] = useState<SummaryGrade | null>(null);
  const [template, setTemplate] = useState<TemplateVerdict | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(SST_TOTAL_SECONDS);
  const playedRef = useRef(false);
  const recordedRef = useRef(false);

  const count = typed.trim() ? tokenize(typed).length : 0;
  const zone = wordZoneOf(count, SST_MIN_WORDS, SST_MAX_WORDS);
  const near =
    (count >= SST_NEAR_MIN && count < SST_MIN_WORDS) ||
    (count > SST_MAX_WORDS && count <= SST_NEAR_MAX);

  // Fim do TTS → começa o cronômetro de escrita (10:00).
  useEffect(() => {
    if (phase === "playing" && playedRef.current && !synth.speaking) {
      setPhase("writing");
    }
  }, [phase, synth.speaking]);

  // Cronômetro regressivo durante a escrita.
  useEffect(() => {
    if (phase !== "writing" || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, secondsLeft]);

  const submit = () => {
    if (recordedRef.current) return;
    const g = gradeSst(question.transcript, typed);
    setGrade(g);
    setTemplate(detectTemplate(typed));
    setPhase("result");
    recordedRef.current = true;
    recordAttempt({
      qid: question.id,
      taskType: question.taskType,
      mode: "manual",
      contentScore: null,
      score: g.score,
      wpm: null,
      durationMs: (SST_TOTAL_SECONDS - secondsLeft) * 1000,
      metrics: { words: g.words, coverage: g.coverage },
    });
  };

  // Tempo esgotado → submete automaticamente.
  useEffect(() => {
    if (phase === "writing" && secondsLeft === 0) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft]);

  const play = () => {
    playedRef.current = true;
    synth.speak(question.transcript, 1);
    setPhase("playing");
  };

  const skipAudio = () => {
    synth.cancel();
    playedRef.current = true;
    setPhase("writing");
  };

  const retry = () => {
    synth.cancel();
    setPhase("idle");
    setTyped("");
    setGrade(null);
    setTemplate(null);
    setSecondsLeft(SST_TOTAL_SECONDS);
    playedRef.current = false;
    recordedRef.current = false;
  };

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;

  const timeDanger = secondsLeft <= 60;

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? "A palestra toca uma vez; depois você tem 10 minutos para resumir em 50-70 palavras."
          : phase === "writing"
            ? "Escreva o resumo — o cronômetro continua correndo."
            : "Confira a cobertura semântica em relação à transcrição."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <>
              <Button variant="outline" onClick={skipAudio}>
                Pular áudio
              </Button>
              <Button size="lg" onClick={play} disabled={!synth.supported}>
                Ouvir palestra
              </Button>
            </>
          ) : null}
          {phase === "playing" ? (
            <Button variant="outline" onClick={skipAudio}>
              Pular áudio
            </Button>
          ) : null}
          {phase === "writing" ? (
            <Button size="lg" onClick={submit} disabled={count === 0}>
              Corrigir
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
      {/* Prompt / player */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        <p className="text-sm italic text-muted-foreground">{question.prompt}</p>
        <div className="mt-4 flex items-center gap-3">
          <span
            className={cn(
              "font-mono text-2xl tabular-nums",
              phase === "writing" && timeDanger ? "text-destructive" : "text-foreground",
            )}
          >
            {phase === "idle" || phase === "playing" ? fmt(SST_TOTAL_SECONDS) : fmt(secondsLeft)}
          </span>
          <span className="text-xs text-muted-foreground">
            {phase === "idle"
              ? "reprodução única da palestra"
              : phase === "playing"
                ? "tocando…"
                : "para escrever"}
          </span>
        </div>
      </div>

      {/* Área de resposta */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        <textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={phase === "idle" || phase === "playing" || phase === "result"}
          rows={8}
          placeholder={
            phase === "idle" || phase === "playing"
              ? "Ouça a palestra primeiro — o campo abre quando o áudio termina…"
              : "Escreva seu resumo de 50-70 palavras…"
          }
          className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        />
        <p
          className={cn(
            "mt-2 text-xs",
            zone === "ok" ? "text-success" : near ? "text-warning" : "text-destructive",
          )}
        >
          {count} palavra{count === 1 ? "" : "s"} · zona {SST_MIN_WORDS}-{SST_MAX_WORDS}
          {zone === "short"
            ? near
              ? " (perto da zona)"
              : " (curto demais)"
            : zone === "long"
              ? near
                ? " (perto da zona)"
                : " (longo demais)"
              : ""}
        </p>
      </div>

      {/* Resultado */}
      {phase === "result" && grade ? (
        <div className="mt-6 space-y-4">
          <TemplateWarning verdict={template} />
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-serif text-lg font-semibold text-primary tabular-nums">
                {grade.score}%
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {grade.words} palavras · {grade.coverage}% de cobertura
              </span>
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Keywords da palestra
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {grade.covered.map((k) => (
                <span
                  key={k}
                  className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs text-success"
                >
                  {k}
                </span>
              ))}
              {grade.missed.map((k) => (
                <span
                  key={k}
                  className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs text-destructive"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>

          <details className="rounded-xl border border-border/60 bg-card p-4 text-sm">
            <summary className="cursor-pointer font-medium">Ver transcrição da palestra</summary>
            <PlusWordText
              text={question.transcript}
              enabled={wordTranslation}
              audioEnabled={plusAudio}
              aiEnabled={plus.aiTranslation}
              source={{ type: question.taskType, qid: question.id }}
              className="mt-2 font-serif leading-relaxed text-muted-foreground"
            />
            <PlusPhraseCard
              type={question.taskType}
              qid={question.id}
              sentences={splitSentences(question.transcript)}
              enabled={phraseTranslation}
              audioEnabled={plusAudio}
              aiEnabled={plus.aiTranslation}
            />
          </details>

          {question.gradingNotes ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <p className="font-medium">O que o corretor procura</p>
              <p className="mt-1 text-muted-foreground">{question.gradingNotes}</p>
            </div>
          ) : null}

          {question.sample ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Resposta modelo</p>
                <PlusSpeakButton
                  text={question.sample}
                  enabled={plusAudio}
                  label="ouvir resposta"
                />
              </div>
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
