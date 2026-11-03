import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { metaByType } from "@/lib/pte";
import { gradeReorder, type ReorderGrade } from "@/lib/pte/reorder";
import type { ReorderQuestion } from "@/lib/pte/types";
import { recordAttempt, useAppState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "result";

export function ReorderPractice({ question }: { question: ReorderQuestion }) {
  const navigate = useNavigate();
  const plus = useAppState().settings.plus;
  const wordTranslation = plus.wordTranslation;
  const phraseTranslation = plus.phraseTranslation;
  const plusAudio = plus.plusAudio;
  const pool = useMemo(() => metaByType("reorder_paragraphs"), []);

  // Ordem embaralhada estável por questão (Fisher-Yates com seed do id).
  const initial = useMemo(() => {
    const n = question.items.length;
    let seed = 0;
    for (const c of question.id) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i -= 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      const vi = arr[i];
      const vj = arr[j];
      if (vi !== undefined && vj !== undefined) {
        arr[i] = vj;
        arr[j] = vi;
      }
    }
    // evita ordem correta por acaso
    if (arr.every((v, i) => v === i)) arr.reverse();
    return arr;
  }, [question.id, question.items.length]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [order, setOrder] = useState<number[]>(initial);
  const [grade, setGrade] = useState<ReorderGrade | null>(null);
  const recordedRef = useRef(false);

  useEffect(() => {
    setPhase("idle");
    setOrder(initial);
    setGrade(null);
    recordedRef.current = false;
  }, [question.id, initial]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const it = next.splice(from, 1)[0];
    if (it === undefined) return;
    next.splice(to, 0, it);
    setOrder(next);
  };

  const submit = () => {
    const g = gradeReorder(order, question.correctOrder, question);
    setGrade(g);
    setPhase("result");
    if (!recordedRef.current) {
      recordAttempt({
        qid: question.id,
        taskType: "reorder_paragraphs",
        mode: "manual",
        contentScore: null,
        score: g.score,
        wpm: null,
        durationMs: 0,
        metrics: { pairs: g.pairsCorrect, total: g.pairsTotal },
      });
      recordedRef.current = true;
    }
  };

  const retry = () => {
    setPhase("idle");
    setOrder(initial);
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
          ? "Reordene os trechos (↑/↓ ou arraste) e corrija: cada par adjacente certo vale ponto."
          : "Cada par adjacente correto vale 1 ponto; ordem exata = 100%."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button size="lg" onClick={submit}>
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
            text={question.items.join(" ")}
            enabled={plusAudio}
            label="ouvir trechos"
            className="shrink-0"
          />
        </div>
        <ul className="space-y-2">
          {order.map((itemIdx, pos) => {
            const isCorrectSlot = phase === "result" && question.correctOrder[pos] === itemIdx;
            return (
              <li
                key={itemIdx}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", String(pos))}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  if (Number.isInteger(from)) move(from, pos);
                }}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-[15px] leading-relaxed",
                  phase === "result"
                    ? isCorrectSlot
                      ? "border-success/40 bg-success/5"
                      : "border-destructive/40 bg-destructive/5"
                    : "border-border bg-background",
                )}
              >
                <span className="mt-0.5 shrink-0 font-serif text-sm text-muted-foreground tabular-nums">
                  {pos + 1}.
                </span>
                <span className="min-w-0 flex-1">
                  <PlusWordText
                    text={question.items[itemIdx] ?? ""}
                    enabled={wordTranslation}
                    audioEnabled={plusAudio}
                    aiEnabled={plus.aiTranslation}
                    source={{ type: question.taskType, qid: question.id }}
                  />
                </span>
                {phase === "idle" ? (
                  <span className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      aria-label="Mover para cima"
                      className="relative rounded px-1.5 py-1 text-xs text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:bg-secondary hover:text-foreground disabled:opacity-30"
                      disabled={pos === 0}
                      onClick={() => move(pos, pos - 1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label="Mover para baixo"
                      className="relative rounded px-1.5 py-1 text-xs text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:bg-secondary hover:text-foreground disabled:opacity-30"
                      disabled={pos === order.length - 1}
                      onClick={() => move(pos, pos + 1)}
                    >
                      ▼
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Pack plus: tradução por frase (tipo 2) + pronúncia por item */}
      <PlusPhraseCard
        type="reorder_paragraphs"
        qid={question.id}
        sentences={question.items}
        enabled={phraseTranslation}
        audioEnabled={plusAudio}
        aiEnabled={plus.aiTranslation}
        neighbors={question.items}
      />

      {phase === "result" && grade ? (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-serif text-lg font-semibold tabular-nums text-primary">
              {grade.score}%
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {grade.pairsCorrect}/{grade.pairsTotal} pares adjacentes corretos
            </span>
            {grade.score === 100 ? (
              <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs text-success">
                Ordem exata ✓
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Parágrafo correto
          </p>
          <p className="mt-2 font-serif text-[15px] leading-relaxed">
            {grade.correctOrder.map((i) => question.items[i]).join(" ")}
          </p>
        </div>
      ) : null}
    </PracticeShell>
  );
}
