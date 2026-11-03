import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { metaByType } from "@/lib/pte";
import type { WriteEssayQuestion } from "@/lib/pte/types";
import { ESSAY_MAX_WORDS, ESSAY_MIN_WORDS, gradeEssay, type EssayGrade } from "@/lib/pte/essay";
import { detectTemplate, type TemplateVerdict } from "@/lib/pte/templateDetector";
import { recordAttempt, useAppState } from "@/lib/storage";
import { TemplateWarning } from "@/components/TemplateWarning";
import { cn } from "@/lib/utils";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { splitSentences } from "@/lib/plus/sentences";
import { PracticeShell } from "./PracticeShell";

const ESSAY_TOTAL_SECONDS = 20 * 60;

type Phase = "idle" | "result";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${`${ss}`.padStart(2, "0")}`;
}

export function WriteEssayPractice({ question }: { question: WriteEssayQuestion }) {
  const navigate = useNavigate();
  const plus = useAppState().settings.plus;
  const wordTranslation = plus.wordTranslation;
  const phraseTranslation = plus.phraseTranslation;
  const plusAudio = plus.plusAudio;
  const pool = useMemo(() => metaByType("write_essay"), []);
  // Mesma segmentação do extractor (src/lib/plus/sentences) para alinhar por índice.
  const sourceSentences = useMemo(
    () => splitSentences(question.prompt || question.text),
    [question.prompt, question.text],
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState("");
  const [seconds, setSeconds] = useState(ESSAY_TOTAL_SECONDS);
  const [grade, setGrade] = useState<EssayGrade | null>(null);
  const [template, setTemplate] = useState<TemplateVerdict | null>(null);
  const recordedRef = useRef(false);

  useEffect(() => {
    setPhase("idle");
    setTyped("");
    setSeconds(ESSAY_TOTAL_SECONDS);
    setGrade(null);
    setTemplate(null);
    recordedRef.current = false;
  }, [question.id]);

  // Cronômetro 20:00 regressivo → auto-submit.
  useEffect(() => {
    if (phase !== "idle") return;
    const t = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  const words = typed.trim() ? typed.trim().split(/\s+/).length : 0;
  const zoneOk = words >= ESSAY_MIN_WORDS && words <= ESSAY_MAX_WORDS;

  const submit = () => {
    if (!typed.trim()) return;
    const g = gradeEssay(typed, question.sample);
    setGrade(g);
    setTemplate(detectTemplate(typed));
    setPhase("result");
    if (!recordedRef.current) {
      recordAttempt({
        qid: question.id,
        taskType: "write_essay",
        mode: "manual",
        contentScore: null,
        score: g.score,
        wpm: null,
        durationMs: (ESSAY_TOTAL_SECONDS - seconds) * 1000,
        metrics: {
          words: g.words,
          coverage:
            g.covered.length + g.missed.length > 0
              ? Math.round((g.covered.length / (g.covered.length + g.missed.length)) * 100)
              : 0,
          paragraphs: g.paragraphs,
        },
      });
      recordedRef.current = true;
    }
  };

  // Auto-submit quando o tempo zera.
  useEffect(() => {
    if (phase === "idle" && seconds === 0 && typed.trim()) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase]);

  const retry = () => {
    setPhase("idle");
    setTyped("");
    setGrade(null);
    setTemplate(null);
    setSeconds(ESSAY_TOTAL_SECONDS);
    recordedRef.current = false;
  };

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle" ? (
          <span className={cn("tabular-nums", seconds < 120 && "text-warning")}>
            ⏱ {fmt(seconds)} restantes · 200-300 palavras
          </span>
        ) : (
          "Compare com a resposta modelo e confira estrutura e vocabulário."
        )
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button size="lg" onClick={submit} disabled={words === 0}>
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
      {/* Enunciado */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {question.essayType ? (
            <span className="rounded-full bg-secondary px-2.5 py-0.5">{question.essayType}</span>
          ) : null}
          <span>20 minutos · 200-300 palavras</span>
          <PlusSpeakButton
            text={question.prompt || question.text}
            enabled={plusAudio}
            label="ouvir enunciado"
            className="ml-auto"
          />
        </div>
        {wordTranslation || plusAudio ? (
          <PlusWordText
            text={question.prompt || question.text}
            enabled={wordTranslation}
            audioEnabled={plusAudio}
            aiEnabled={plus.aiTranslation}
            source={{ type: question.taskType, qid: question.id }}
            className="font-serif text-lg leading-relaxed text-foreground"
          />
        ) : (
          <p className="font-serif text-lg leading-relaxed text-foreground">
            {question.prompt || question.text}
          </p>
        )}
      </div>

      {/* Pack plus: tradução por frase + pronúncia do enunciado */}
      <PlusPhraseCard
        type="write_essay"
        qid={question.id}
        sentences={sourceSentences}
        enabled={phraseTranslation}
        audioEnabled={plusAudio}
        aiEnabled={plus.aiTranslation}
      />

      {/* Área de resposta */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        <textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={phase === "result"}
          rows={14}
          placeholder="Escreva sua redação (introdução, 2 parágrafos de argumento, conclusão)…"
          className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span
            className={cn(
              "tabular-nums",
              zoneOk
                ? "text-success"
                : words < ESSAY_MIN_WORDS
                  ? "text-warning"
                  : "text-destructive",
            )}
          >
            {words} palavra{words === 1 ? "" : "s"} · zona {ESSAY_MIN_WORDS}-{ESSAY_MAX_WORDS}
          </span>
          <span className="tabular-nums text-muted-foreground">⏱ {fmt(seconds)}</span>
        </div>
      </div>

      {/* Resultado */}
      {phase === "result" && grade ? (
        <div className="mt-6 space-y-4">
          <TemplateWarning verdict={template} />
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-serif text-lg font-semibold tabular-nums text-primary">
                {grade.score}%
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {grade.words} palavras · {grade.paragraphs} parágrafo(s)
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs",
                  grade.formOk
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {grade.formOk
                  ? "Forma ok (200-300) ✓"
                  : `Fora da zona 200-300 (${grade.words}) — form = 0 no PTE`}
              </span>
            </div>

            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Keywords da resposta modelo
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

            <p className="mt-3 text-sm text-muted-foreground">
              Conectivos usados:{" "}
              {grade.connectives.length > 0 ? (
                <span className="text-foreground">{grade.connectives.join(" · ")}</span>
              ) : (
                <span className="text-warning">nenhum detectado — estruture os parágrafos</span>
              )}
            </p>
          </div>

          {question.vocabulary.length > 0 ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <p className="font-medium">Vocabulário de alta faixa</p>
              <p className="mt-1 text-muted-foreground">{question.vocabulary.join(" · ")}</p>
            </div>
          ) : null}

          {question.gradingNotes ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <p className="font-medium">Dicas do examinador</p>
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
              <p className="mt-1 whitespace-pre-line font-serif leading-relaxed text-muted-foreground">
                {question.sample}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </PracticeShell>
  );
}
