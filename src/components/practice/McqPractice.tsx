import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { gradeMulti, gradeSingle, type McqMultiGrade, type McqSingleGrade } from "@/lib/pte/mcq";
import { metaByType } from "@/lib/pte";
import type { ChoiceQuestion } from "@/lib/pte/types";
import { recordAttempt, useAppState } from "@/lib/storage";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { cn } from "@/lib/utils";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { plusAudioFor } from "@/lib/plus/plusAudio";
import { splitSentences } from "@/lib/plus/sentences";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "result";

interface ChoiceCopy {
  /** Instrução no rodapé antes de responder. */
  idle: string;
  /** Instrução no rodapé no resultado. */
  result: string;
  /** Rótulo do grupo de opções. */
  optionsLabel: string;
  /** Mostrar botão de áudio (tipos de Listening). */
  audio: boolean;
}

const CHOICE_COPY: Record<ChoiceQuestion["taskType"], ChoiceCopy> = {
  mcq_single: {
    idle: "Leia o texto e escolha a única resposta correta.",
    result: "Compare sua escolha com a resposta e a armadilha da questão.",
    optionsLabel: "Opções",
    audio: false,
  },
  mcq_multi: {
    idle: "Leia o texto e marque todas as respostas corretas (erro marcado desconta ponto).",
    result: "Verde: correta marcada · laranja: correta que faltou · vermelho: marca errada.",
    optionsLabel: "Opções",
    audio: false,
  },
  lst_mcq: {
    idle: "Ouça a gravação uma vez e escolha a única resposta correta.",
    result: "Compare sua escolha com a resposta e a armadilha da questão.",
    optionsLabel: "Opções",
    audio: true,
  },
  lst_mcq_multi: {
    idle: "Ouça a gravação uma vez e marque todas as respostas corretas (erro desconta).",
    result: "Verde: correta marcada · laranja: correta que faltou · vermelho: marca errada.",
    optionsLabel: "Opções",
    audio: true,
  },
  lst_hcs: {
    idle: "Ouça a gravação uma vez e escolha o resumo que melhor representa o áudio.",
    result: "Compare o resumo escolhido com a justificativa da questão.",
    optionsLabel: "Resumos",
    audio: true,
  },
  lst_smw: {
    idle: "Ouça até o bipe final e escolha a palavra que completa a frase.",
    result: "Compare a palavra escolhida com a justificativa da questão.",
    optionsLabel: "Palavra que falta",
    audio: true,
  },
};

export function McqPractice({ question }: { question: ChoiceQuestion }) {
  const navigate = useNavigate();
  const pool = useMemo(() => metaByType(question.taskType), [question.taskType]);
  const synth = useSpeechSynthesis();
  const copy = CHOICE_COPY[question.taskType];
  const plus = useAppState().settings.plus;
  const wordTranslation = plus.wordTranslation;
  const phraseTranslation = plus.phraseTranslation;
  const plusAudio = plus.plusAudio;
  const phraseCovered = question.taskType === "mcq_single" || question.taskType === "mcq_multi";
  const phraseSentences = useMemo(() => splitSentences(question.text), [question.text]);

  const isMulti = question.taskType === "mcq_multi" || question.taskType === "lst_mcq_multi";
  const hasAudio = copy.audio && Boolean(question.audioText || question.transcript);

  const [selected, setSelected] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [grade, setGrade] = useState<McqSingleGrade | McqMultiGrade | null>(null);
  const [played, setPlayed] = useState(false);
  const recordedRef = useRef(false);

  const toggle = (i: number) => {
    if (phase !== "idle") return;
    setSelected((prev) => {
      if (!isMulti) return [i];
      return prev.includes(i) ? prev.filter((p) => p !== i) : [...prev, i];
    });
  };

  const play = () => {
    if (phase === "idle" && played) return;
    synth.speak(question.audioText || question.transcript, 1);
    setPlayed(true);
  };

  const submit = () => {
    if (selected.length === 0) return;
    const g = isMulti
      ? gradeMulti(selected, question.answer, question.options.length)
      : gradeSingle(selected[0] ?? null, question.answer);
    setGrade(g);
    setPhase("result");
    if (!recordedRef.current) {
      const hits = isMulti ? (g as McqMultiGrade).hits : (g as McqSingleGrade).correct ? 1 : 0;
      const falsePositives = isMulti ? (g as McqMultiGrade).falsePositives : 0;
      const tags: string[] = [];
      if (!isMulti && !(g as McqSingleGrade).correct) tags.push("trap");
      if (isMulti && falsePositives > 0) tags.push("falso-positivo");
      recordAttempt({
        qid: question.id,
        taskType: question.taskType,
        mode: "manual",
        contentScore: null,
        score: g.score,
        wpm: null,
        durationMs: 0,
        metrics: {
          selected: selected.length,
          answers: question.answer.length,
          hits,
          falsePositives,
        },
        tags,
      });
      recordedRef.current = true;
    }
  };

  const retry = () => {
    setPhase("idle");
    setSelected([]);
    setGrade(null);
    setPlayed(false);
    recordedRef.current = false;
    synth.cancel();
  };

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;

  const optionClass = (i: number) => {
    if (phase === "idle") {
      return selected.includes(i)
        ? "border-primary bg-primary/10"
        : "border-border hover:border-primary/50";
    }
    const status = isMulti
      ? (grade as McqMultiGrade | null)?.marks[i]?.status
      : question.answer[0] === i
        ? "correct-picked"
        : "neutral";
    if (status === "correct-picked") return "border-success bg-success/10";
    if (status === "correct-missed") return "border-warning bg-warning/10 border-dashed";
    if (status === "wrong-picked") return "border-destructive bg-destructive/10";
    return "border-border opacity-70";
  };

  const optionBadge = (i: number) => {
    if (phase !== "result") {
      return selected.includes(i) ? (
        <span className="text-primary">●</span>
      ) : (
        <span className="text-muted-foreground/40">○</span>
      );
    }
    const status = isMulti
      ? (grade as McqMultiGrade | null)?.marks[i]?.status
      : question.answer[0] === i
        ? "correct-picked"
        : "neutral";
    if (status === "correct-picked") return <span className="text-success">✓</span>;
    if (status === "correct-missed") return <span className="text-warning">○ faltou</span>;
    if (status === "wrong-picked") return <span className="text-destructive">✗</span>;
    return <span className="text-muted-foreground/40">○</span>;
  };

  const rawLabel =
    isMulti && grade
      ? `${(grade as McqMultiGrade).raw} ponto${(grade as McqMultiGrade).raw === 1 ? "" : "s"}`
      : grade
        ? (grade as McqSingleGrade).correct
          ? "Correto"
          : "Incorreto"
        : "";

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={phase === "idle" ? copy.idle : copy.result}
      footerActions={
        <>
          {hasAudio && phase === "idle" ? (
            <Button variant="outline" onClick={play} disabled={played || !synth.supported}>
              {played ? "Já reproduzida" : "Ouvir gravação"}
            </Button>
          ) : null}
          {phase === "idle" ? (
            <Button size="lg" onClick={submit} disabled={selected.length === 0}>
              Corrigir
            </Button>
          ) : null}
          {phase === "result" && hasAudio ? (
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
      {/* Passage / prompt */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        {question.prompt ? (
          <p className="mb-4 text-sm italic text-muted-foreground">{question.prompt}</p>
        ) : null}
        {question.taskType === "lst_smw" ? (
          <p className="font-serif text-[15px] leading-relaxed text-foreground/90">
            {question.text}{" "}
            <span className="mx-0.5 inline-block w-24 border-b-2 border-dashed border-primary/60 align-baseline" />
            <span className="text-muted-foreground"> 🔊</span>
          </p>
        ) : wordTranslation || plusAudio ? (
          <PlusWordText
            text={question.text}
            enabled={wordTranslation}
            audioEnabled={plusAudio}
            aiEnabled={plus.aiTranslation}
            source={{ type: question.taskType, qid: question.id }}
            className="font-serif text-[15px] leading-relaxed text-foreground/90"
          />
        ) : (
          <p className="font-serif text-[15px] leading-relaxed text-foreground/90">
            {question.text}
          </p>
        )}
        {plusAudioFor(question, "text", question.text) ? (
          <div className="mt-3">
            <PlusSpeakButton text={question.text} enabled={plusAudio} label="ouvir texto" />
          </div>
        ) : null}
      </div>

      {/* Pack plus: tradução por frase (tipo 2) + pronúncia — só Reading MCQ */}
      {phraseCovered ? (
        <PlusPhraseCard
          type={question.taskType}
          qid={question.id}
          sentences={phraseSentences}
          enabled={phraseTranslation}
          audioEnabled={plusAudio}
          aiEnabled={plus.aiTranslation}
          options={question.options}
        />
      ) : null}

      {/* Opções */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {copy.optionsLabel}
            {isMulti ? " · marque todas as corretas" : " · escolha uma"}
          </p>
          {plusAudioFor(question, "options", question.options.join(". ")) ? (
            <PlusSpeakButton
              text={question.options.join(". ")}
              enabled={plusAudio}
              label="ouvir opções"
            />
          ) : null}
        </div>
        <div className="mt-3 space-y-2" role={isMulti ? "group" : "radiogroup"}>
          {question.options.map((opt, i) => (
            <button
              key={`opt-${i}`}
              type="button"
              role={isMulti ? "checkbox" : "radio"}
              aria-checked={selected.includes(i)}
              onClick={() => toggle(i)}
              disabled={phase === "result"}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default",
                optionClass(i),
              )}
            >
              <span className="mt-0.5 w-5 shrink-0 text-center text-xs">{optionBadge(i)}</span>
              <span className="shrink-0 font-serif font-semibold">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-foreground/90">{opt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Resultado */}
      {phase === "result" && grade ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-serif text-lg font-semibold text-primary tabular-nums">
                {grade.score}%
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">{rawLabel}</span>
              {isMulti ? (
                <span className="text-sm text-muted-foreground tabular-nums">
                  · {(grade as McqMultiGrade).hits}/{(grade as McqMultiGrade).answerCount} corretas
                  marcadas · {(grade as McqMultiGrade).falsePositives} marca
                  {(grade as McqMultiGrade).falsePositives === 1 ? "" : "s"} errada
                  {(grade as McqMultiGrade).falsePositives === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            {isMulti ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Pontuação = corretas marcadas − marcas erradas (mínimo 0).
              </p>
            ) : null}
            {question.answer.length > 0 ? (
              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">Resposta correta: </span>
                <span className="font-medium text-foreground">
                  {question.answer.map((i) => String.fromCharCode(65 + i)).join(", ")}
                </span>
              </p>
            ) : null}
          </div>

          {question.explanation ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Explicação</p>
                {plusAudioFor(question, "explanation", question.explanation) ? (
                  <PlusSpeakButton
                    text={question.explanation}
                    enabled={plusAudio}
                    label="ouvir explicação"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-muted-foreground">{question.explanation}</p>
            </div>
          ) : null}
          {question.trap ? (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
              <p className="font-medium">Armadilha comum</p>
              <p className="mt-1 text-muted-foreground">{question.trap}</p>
            </div>
          ) : null}

          {hasAudio ? (
            <details className="rounded-xl border border-border/60 bg-card p-4 text-sm">
              <summary className="cursor-pointer font-medium">Ver transcrição do áudio</summary>
              <p className="mt-2 font-serif leading-relaxed text-muted-foreground">
                {question.transcript || question.audioText}
              </p>
            </details>
          ) : null}
        </div>
      ) : null}
    </PracticeShell>
  );
}
