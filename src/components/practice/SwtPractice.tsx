import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { metaByType, tokenize } from "@/lib/pte";
import type { SwtQuestion } from "@/lib/pte/types";
import {
  gradeSwt,
  SWT_MAX_WORDS,
  SWT_MIN_WORDS,
  type SummaryGrade,
  wordZoneOf,
} from "@/lib/pte/summary";
import { recordAttempt, useAppState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { detectTemplate, type TemplateVerdict } from "@/lib/pte/templateDetector";
import { TemplateWarning } from "@/components/TemplateWarning";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { splitSentences } from "@/lib/plus/sentences";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "result";

export function SwtPractice({ question }: { question: SwtQuestion }) {
  const navigate = useNavigate();
  const plus = useAppState().settings.plus;
  const wordTranslation = plus.wordTranslation;
  const phraseTranslation = plus.phraseTranslation;
  const plusAudio = plus.plusAudio;
  const pool = useMemo(() => metaByType("swt"), []);
  // Mesma segmentação do extractor (src/lib/plus/sentences) para alinhar por índice.
  const sourceSentences = useMemo(() => splitSentences(question.text), [question.text]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState("");
  const [grade, setGrade] = useState<SummaryGrade | null>(null);
  const [template, setTemplate] = useState<TemplateVerdict | null>(null);
  const recordedRef = useRef(false);

  const count = typed.trim() ? tokenize(typed).length : 0;
  const zone = wordZoneOf(count, SWT_MIN_WORDS, SWT_MAX_WORDS);

  const submit = () => {
    if (!typed.trim()) return;
    const g = gradeSwt(question.text, typed);
    setGrade(g);
    setTemplate(detectTemplate(typed));
    setPhase("result");
    if (!recordedRef.current) {
      recordAttempt({
        qid: question.id,
        taskType: "swt",
        mode: "manual",
        contentScore: null,
        score: g.score,
        wpm: null,
        durationMs: 0,
        metrics: { words: g.words, coverage: g.coverage, sentences: g.sentenceCount },
      });
      recordedRef.current = true;
    }
  };

  const retry = () => {
    setPhase("idle");
    setTyped("");
    setGrade(null);
    setTemplate(null);
    recordedRef.current = false;
  };

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? "Uma frase única, 5-75 palavras, capturando a ideia principal e a ressalva."
          : "Confira a cobertura de keywords e se você manteve uma frase única."
      }
      footerActions={
        <>
          {phase === "idle" ? (
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
      {/* Texto-fonte */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        {question.prompt ? (
          <p className="mb-4 text-sm italic text-muted-foreground">{question.prompt}</p>
        ) : null}
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {wordTranslation || plusAudio ? (
              <PlusWordText
                text={question.text}
                enabled={wordTranslation}
                audioEnabled={plusAudio}
                aiEnabled={plus.aiTranslation}
                questionText={question.prompt}
                source={{ type: question.taskType, qid: question.id }}
                className="font-serif text-[17px] leading-relaxed text-foreground"
              />
            ) : (
              <p className="font-serif text-[17px] leading-relaxed text-foreground">
                {question.text}
              </p>
            )}
          </div>
          <PlusSpeakButton
            text={question.text}
            enabled={plusAudio}
            label="ouvir texto"
            className="mt-1 shrink-0"
          />
        </div>
      </div>

      {/* Pack plus: tradução por frase + pronúncia do texto-fonte */}
      <PlusPhraseCard
        type="swt"
        qid={question.id}
        sentences={sourceSentences}
        enabled={phraseTranslation}
        audioEnabled={plusAudio}
        aiEnabled={plus.aiTranslation}
        questionText={question.prompt}
      />

      {/* Área de resposta */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        <textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={phase === "result"}
          rows={4}
          placeholder="Escreva UMA frase que resuma o texto…"
          className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span
            className={cn(
              zone === "ok"
                ? "text-success"
                : zone === "short"
                  ? "text-warning"
                  : "text-destructive",
            )}
          >
            {count} palavra{count === 1 ? "" : "s"} · zona {SWT_MIN_WORDS}-{SWT_MAX_WORDS}
            {zone === "short" ? " (curto demais)" : zone === "long" ? " (longo demais)" : ""}
          </span>
          <span className="text-muted-foreground">
            {countSentencesLive(typed)} ponto{countSentencesLive(typed) === 1 ? "" : "s"} final
            {countSentencesLive(typed) === 1 ? "" : "es"}
          </span>
        </div>
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
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs",
                  grade.singleSentence
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {grade.singleSentence
                  ? "Frase única ✓"
                  : `${grade.sentenceCount} frases — o PTE exige 1`}
              </span>
            </div>

            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Keywords do texto-fonte
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
            {grade.connectives.length > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Conectivos usados:{" "}
                <span className="text-foreground">{grade.connectives.join(" · ")}</span>
              </p>
            ) : (
              <p className="mt-3 text-sm text-warning">
                Nenhum conectivo detectado — estruture com although/while/despite.
              </p>
            )}
          </div>

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

/** Contagem ao vivo de frases (mesma regra do corretor). */
function countSentencesLive(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
}
