import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { metaByType } from "@/lib/pte";
import { gradeDropdown, type DropdownGrade } from "@/lib/pte/fibDropdown";
import type { ReadFibQuestion } from "@/lib/pte/types";
import { recordAttempt, useAppState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { splitSentences, stripBlanks } from "@/lib/plus/sentences";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "result";

/** Renderiza o passage trocando cada "______(k)" por um dropdown. */
function renderPassage(
  question: ReadFibQuestion,
  selections: (string | null)[],
  phase: Phase,
  grade: DropdownGrade | null,
  onSelect: (blankIdx: number, value: string) => void,
  wordTranslation: boolean,
  audioEnabled: boolean,
  aiTranslation: boolean,
): ReactNode[] {
  const parts = question.text.split(/_{5,}\((\d+)\)/);
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    out.push(
      <PlusWordText
        key={`t${i}`}
        text={parts[i] ?? ""}
        enabled={wordTranslation}
        audioEnabled={audioEnabled}
        aiEnabled={aiTranslation}
        questionText={stripBlanks(question.text)}
        source={{ type: question.taskType, qid: question.id }}
        inline
        className="font-serif"
      />,
    );
    if (i + 1 < parts.length) {
      const blankIdx = Number(parts[i + 1]) - 1;
      const blank = question.blanks[blankIdx];
      if (!blank) continue;
      const sel = selections[blankIdx] ?? null;
      const correct = grade?.correctIndexes.includes(blankIdx) ?? false;
      out.push(
        <span key={`b${blankIdx}`} className="mx-1 inline-flex items-center gap-1 align-middle">
          <select
            value={sel ?? ""}
            disabled={phase === "result"}
            onChange={(e) => onSelect(blankIdx, e.target.value)}
            className={cn(
              "min-h-[44px] rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-80",
              phase === "result"
                ? correct
                  ? "border-success/60"
                  : "border-destructive/60"
                : "border-input",
            )}
          >
            <option value="" disabled>
              —
            </option>
            {blank.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {phase === "result" && !correct && sel !== null ? (
            <span className="text-xs text-success">✓ {blank.answer}</span>
          ) : null}
        </span>,
      );
    }
  }
  return out;
}

export function FibDropdownPractice({ question }: { question: ReadFibQuestion }) {
  const navigate = useNavigate();
  const plus = useAppState().settings.plus;
  const wordTranslation = plus.wordTranslation;
  const phraseTranslation = plus.phraseTranslation;
  const plusAudio = plus.plusAudio;
  const phraseSentences = useMemo(
    () => splitSentences(stripBlanks(question.text)),
    [question.text],
  );
  const pool = useMemo(() => metaByType("read_fib"), []);

  const [phase, setPhase] = useState<Phase>("idle");
  const [selections, setSelections] = useState<(string | null)[]>(() =>
    question.blanks.map(() => null),
  );
  const [grade, setGrade] = useState<DropdownGrade | null>(null);
  const recordedRef = useRef(false);

  useEffect(() => {
    setPhase("idle");
    setSelections(question.blanks.map(() => null));
    setGrade(null);
    recordedRef.current = false;
  }, [question.id, question.blanks]);

  const answered = selections.filter((s) => s !== null).length;

  const onSelect = (blankIdx: number, value: string) => {
    setSelections((prev) => {
      const next = [...prev];
      next[blankIdx] = value || null;
      return next;
    });
  };

  const submit = () => {
    const g = gradeDropdown(selections, question.blanks);
    setGrade(g);
    setPhase("result");
    if (!recordedRef.current) {
      recordAttempt({
        qid: question.id,
        taskType: "read_fib",
        mode: "manual",
        contentScore: null,
        score: g.score,
        wpm: null,
        durationMs: 0,
        metrics: { correct: g.correct, total: g.total },
      });
      recordedRef.current = true;
    }
  };

  const retry = () => {
    setPhase("idle");
    setSelections(question.blanks.map(() => null));
    setGrade(null);
    recordedRef.current = false;
  };

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? `${answered}/${question.blanks.length} lacunas preenchidas`
          : "Palavras certas e erradas são avaliadas: cada lacuna correta vale 1 ponto."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button size="lg" onClick={submit} disabled={answered === 0}>
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
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-sm text-muted-foreground">{question.prompt}</p>
          <PlusSpeakButton
            text={stripBlanks(question.text)}
            enabled={plusAudio}
            label="ouvir texto"
            className="shrink-0"
          />
        </div>
        <p className="font-serif text-[17px] leading-loose text-foreground">
          {renderPassage(
            question,
            selections,
            phase,
            grade,
            onSelect,
            wordTranslation,
            plusAudio,
            plus.aiTranslation,
          )}
        </p>
      </div>

      {/* Pack plus: tradução por frase + pronúncia por frase */}
      <PlusPhraseCard
        type="read_fib"
        qid={question.id}
        sentences={phraseSentences}
        enabled={phraseTranslation}
        audioEnabled={plusAudio}
        aiEnabled={plus.aiTranslation}
        questionText={stripBlanks(question.text)}
      />

      {phase === "result" && grade ? (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-serif text-lg font-semibold tabular-nums text-primary">
              {grade.score}%
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {grade.correct}/{grade.total} lacunas corretas
            </span>
            {grade.score === 100 ? (
              <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs text-success">
                Todas certas ✓
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Gabarito
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {question.blanks.map((b, i) => (
              <li key={i}>
                <span className="text-foreground">{b.answer}</span>
                <span className="text-xs"> · {b.options.join(", ")}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </PracticeShell>
  );
}
