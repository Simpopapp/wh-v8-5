import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { gradeDictation, type DictationGrade } from "@/lib/pte/dictation";
import { metaByType, tokenize } from "@/lib/pte";
import type { DictationQuestion } from "@/lib/pte/types";
import { recordAttempt, useAppState } from "@/lib/storage";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { splitSentences } from "@/lib/plus/sentences";
import { cn } from "@/lib/utils";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "result";

export function WfdPractice({ question }: { question: DictationQuestion }) {
  const navigate = useNavigate();
  const pool = useMemo(() => metaByType("wfd"), []);
  const synth = useSpeechSynthesis();
  const plus = useAppState().settings.plus;
  const phraseTranslation = plus.phraseTranslation;
  const plusAudio = plus.plusAudio;
  const phraseSentences = useMemo(() => splitSentences(question.text), [question.text]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState("");
  const [grade, setGrade] = useState<DictationGrade | null>(null);
  const [played, setPlayed] = useState(false);
  const recordedRef = useRef(false);

  const typedCount = typed.trim() ? tokenize(typed).length : 0;
  const audioText = question.audioText || question.answer;

  const play = () => {
    // Modo simulado: 1 reprodução antes da resposta; replay liberado no resultado.
    if (phase === "idle" && played) return;
    synth.speak(audioText, 1);
    setPlayed(true);
  };

  const submit = () => {
    if (!typed.trim()) return;
    const g = gradeDictation(question.answer, typed);
    setGrade(g);
    setPhase("result");
    if (!recordedRef.current) {
      const missedWords = g.marks
        .filter((m) => m.status === "missed")
        .map((m) => m.word.toLowerCase());
      recordAttempt({
        qid: question.id,
        taskType: "wfd",
        mode: "manual",
        contentScore: null,
        score: g.score,
        wpm: null,
        durationMs: 0,
        metrics: { hits: g.hits, missed: g.missed, extras: g.extras.length },
        tags: [...new Set(missedWords)].slice(0, 6).map((w) => `missed:${w}`),
      });
      recordedRef.current = true;
    }
  };

  const retry = () => {
    setPhase("idle");
    setTyped("");
    setGrade(null);
    setPlayed(false);
    recordedRef.current = false;
    synth.cancel();
  };

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? "Ouça a frase uma vez e digite exatamente o que ouvir — casing e pontuação não contam."
          : "Compare as palavras destacadas: verdes acertaram, riscadas faltaram."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button variant="outline" onClick={play} disabled={played || !synth.supported}>
              {played ? "Já reproduzida" : "Ouvir frase"}
            </Button>
          ) : null}
          {phase === "idle" ? (
            <Button size="lg" onClick={submit} disabled={typedCount === 0}>
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
      {/* Área de resposta */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        {question.prompt ? (
          <p className="mb-4 text-sm italic text-muted-foreground">{question.prompt}</p>
        ) : null}
        <textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={phase === "result"}
          rows={4}
          placeholder="Digite a frase que você ouviu…"
          className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {typedCount} palavra{typedCount === 1 ? "" : "s"} digitada{typedCount === 1 ? "" : "s"}
        </p>
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
                {grade.hits}/{grade.total} palavras · {grade.extras.length} extra
                {grade.extras.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Resposta correta, palavra a palavra
            </p>
            <div className="mt-2 flex flex-wrap gap-x-1.5 gap-y-1 font-serif text-[15px] leading-snug">
              {grade.marks.map((mk, i) => (
                <span
                  key={`${mk.word}-${i}`}
                  className={cn(
                    mk.status === "hit"
                      ? "text-success"
                      : "text-destructive line-through decoration-destructive/50",
                  )}
                >
                  {mk.word}
                </span>
              ))}
            </div>
            {grade.extras.length > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Palavras extras (não fazem parte da frase):{" "}
                <span className="text-warning">{grade.extras.join(" · ")}</span>
              </p>
            ) : null}
          </div>

          {/* Pack plus: tradução por frase (tipo 2) + pronúncia — gabarito no resultado */}
          <PlusPhraseCard
            type="wfd"
            qid={question.id}
            sentences={phraseSentences}
            enabled={phraseTranslation}
            audioEnabled={plusAudio}
            aiEnabled={plus.aiTranslation}
          />

          {question.explanation ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Dica de treino</p>
                <PlusSpeakButton
                  text={question.explanation}
                  enabled={plusAudio}
                  label="ouvir dica"
                />
              </div>
              <p className="mt-1 text-muted-foreground">{question.explanation}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </PracticeShell>
  );
}
