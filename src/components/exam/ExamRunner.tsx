import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatHero } from "@/components/layout/StatHero";
import { MicNotice } from "@/components/MicNotice";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/TopNav";
import {
  SECTION_META,
  getMeta,
  tokenize,
  type AnswerShortQuestion,
  type ChoiceQuestion,
  type DescribeImageQuestion,
  type DictationQuestion,
  type FibQuestion,
  type HiwQuestion,
  type ReadAloudQuestion,
  type ReadFibQuestion,
  type RepeatSentenceQuestion,
  type RespondSituationQuestion,
  type RetellLectureQuestion,
  type ReorderQuestion,
  type SgdQuestion,
  type SstQuestion,
  type SummaryChoiceQuestion,
  type SwtQuestion,
  type UnifiedQuestion,
  type WriteEssayQuestion,
} from "@/lib/pte";
import {
  buildExamQueue,
  examLabel,
  examQuestionCount,
  examReviewQids,
  examTiming,
  gradeExamSummary,
  type ExamId,
  type ExamResultCause,
  type ExamResultRow,
} from "@/lib/pte/exam";
import { gradeDictation, gradeFib, gradeHiw, parseFibSegments } from "@/lib/pte/dictation";
import { gradeDropdown } from "@/lib/pte/fibDropdown";
import { gradeEssay } from "@/lib/pte/essay";
import { gradeReorder } from "@/lib/pte/reorder";
import { gradeMulti, gradeSingle } from "@/lib/pte/mcq";
import { gradeSst, gradeSwt } from "@/lib/pte/summary";
import { gradeAnswerShort, gradeRepeatSentence, gradeRetell } from "@/lib/pte/speaking";
import { DESCRIBE_IMAGE_ASSETS } from "@/lib/pte/describeImageAssets";
import {
  addSessionRecord,
  clearExamDraft,
  getExamDraft,
  recordAttempt,
  saveExamDraft,
  updateSettings,
  useAppState,
} from "@/lib/storage";
import { startErrorsSessionForQids } from "@/lib/session";
import {
  causeOfVerdict,
  decideOralVerdict,
  waitForOralFinalization,
  type OralInput,
} from "@/lib/pte/oralPolicy";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { cn } from "@/lib/utils";

type SpeechQuestion =
  | ReadAloudQuestion
  | RepeatSentenceQuestion
  | RetellLectureQuestion
  | AnswerShortQuestion
  // Fase 7: os 3 tipos novos também são fala (DI mostra a imagem no lugar do texto).
  | SgdQuestion
  | RespondSituationQuestion
  | DescribeImageQuestion;

interface ExamWidgetProps {
  /** Registra o submit da questão — o cronômetro chama ao zerar (auto-submit). */
  registerSubmit: (fn: () => void) => void;
  /** Conclui a questão: score, causa (§1.5) e resposta enviada (§1.6). */
  onDone: (score: number | null, cause?: ExamResultCause, answer?: string) => void;
}

/** Marca comum das tentativas de exame (fica fora da média de prática). */
const EXAM_TAG = "exam";

// ---------- Widget: Speaking (RA / RS / RL / ASQ) ----------

/**
 * Gradador por tipo de fala (D6): prática e exame usam a MESMA política
 * (oralPolicy) sobre o mesmo OralInput — o gradador é o único ponto variável.
 */
function gradeSpeechQuestion(
  question: SpeechQuestion,
  transcript: string,
  durationMs: number,
  pauses: number,
): { score: number } {
  if (question.taskType === "retell_lecture") {
    return { score: gradeRetell(question.transcript, transcript, durationMs, pauses).score };
  }
  if (question.taskType === "answer_short") {
    return { score: gradeAnswerShort(question.answer, transcript).score };
  }
  if (question.taskType === "summarize_group_discussion") {
    // SGD: correção contra a transcrição completa da discussão.
    return { score: gradeRetell(question.text, transcript, durationMs, pauses).score };
  }
  if (question.taskType === "respond_to_situation") {
    // RTS: correção contra as keywords da resposta modelo.
    return {
      score: gradeRetell(question.sample || question.text, transcript, durationMs, pauses).score,
    };
  }
  if (question.taskType === "describe_image") {
    // DI: correção contra a descrição de referência verificada.
    return { score: gradeRetell(question.text, transcript, durationMs, pauses).score };
  }
  const reference =
    question.taskType === "repeat_sentence"
      ? question.answer || question.transcript
      : question.text;
  return { score: gradeRepeatSentence(reference, transcript, durationMs, pauses).score };
}

function SpeechWidget({
  question,
  registerSubmit,
  onDone,
}: ExamWidgetProps & { question: SpeechQuestion }) {
  const rec = useSpeechRecognition();
  const synth = useSpeechSynthesis();
  const [stage, setStage] = useState<"idle" | "record" | "analyzing">("idle");
  const [played, setPlayed] = useState(false);
  const startedAtRef = useRef(0);
  const doneRef = useRef(false);

  const needsAudio = question.taskType !== "read_aloud" && question.taskType !== "describe_image";
  const audioText = question.audioText || question.transcript;
  const showPassage = question.taskType === "read_aloud";

  const play = () => {
    if (played) return;
    synth.speak(audioText, 1);
    setPlayed(true);
  };

  // Política oral UNIFICADA (D6): bloqueia reentrada, espera a finalização do
  // ASR (450 ms pós-stop, como na prática) e decide o veredito pela política
  // compartilhada — falha técnica/vazio/não-gradável NUNCA vira 0 injusto.
  const submit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setStage("analyzing");
    void waitForOralFinalization(() => rec.stop()).then(() => {
      const input: OralInput = {
        supported: rec.supported,
        error: rec.error,
        transcript: rec.getTranscript(),
        durationMs: startedAtRef.current ? Date.now() - startedAtRef.current : 0,
        pauses: rec.getStats().pauses,
      };
      const verdict = decideOralVerdict(input, (transcript, durationMs, pauses) =>
        gradeSpeechQuestion(question, transcript, durationMs, pauses),
      );
      recordAttempt({
        qid: question.id,
        taskType: question.taskType,
        mode: "speech",
        score: verdict.score,
        wpm: null,
        durationMs: input.durationMs,
        tags: [EXAM_TAG],
      });
      onDone(
        verdict.score,
        causeOfVerdict(verdict),
        input.transcript ? input.transcript.slice(0, 500) : undefined,
      );
    });
  }, [question, rec, onDone]);

  useEffect(() => {
    registerSubmit(submit);
  }, [registerSubmit, submit]);

  const startRecording = () => {
    if (!rec.supported || doneRef.current) return;
    startedAtRef.current = Date.now();
    setStage("record");
    rec.start({ onSilence: () => submit() });
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
      <MicNotice />
      {showPassage ? (
        <p className="font-serif text-[15px] leading-relaxed text-foreground/90">{question.text}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {question.taskType === "retell_lecture"
            ? "Ouça a palestra e, depois, fale um resumo em voz alta."
            : question.taskType === "repeat_sentence"
              ? "Ouça a frase e repita exatamente o que ouviu."
              : question.taskType === "summarize_group_discussion"
                ? "Ouça a discussão entre 3 pessoas e, depois, faça um resumo falado."
                : question.taskType === "respond_to_situation"
                  ? "Ouça a situação e responda como se estivesse nela."
                  : question.taskType === "describe_image"
                    ? "Descreva o gráfico em detalhe."
                    : "Ouça a pergunta e responda em uma ou duas palavras."}
        </p>
      )}

      {question.taskType === "describe_image" ? (
        <img
          src={DESCRIBE_IMAGE_ASSETS[question.image]}
          alt={question.alt}
          className="mt-4 max-h-72 w-auto max-w-full rounded-xl border border-border bg-background p-2"
          loading="lazy"
        />
      ) : null}

      {needsAudio ? (
        <Button
          variant="outline"
          className="mt-4"
          onClick={play}
          disabled={played || !synth.supported}
        >
          {played ? "Já reproduzida" : "Ouvir áudio"}
        </Button>
      ) : null}

      <div className="mt-5">
        {!rec.supported ? (
          <p className="text-sm text-warning">
            Reconhecimento de voz indisponível neste navegador — use “Pular questão”.
          </p>
        ) : stage === "analyzing" ? (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            Avaliando sua resposta…
          </p>
        ) : stage === "idle" ? (
          <Button size="lg" onClick={startRecording}>
            Gravar resposta
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm text-muted-foreground">Gravando — fale agora.</span>
            <Button size="lg" onClick={submit}>
              Concluir fala
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Widget: WFD (ditado) ----------

function DictationWidget({
  question,
  registerSubmit,
  onDone,
}: ExamWidgetProps & { question: DictationQuestion }) {
  const synth = useSpeechSynthesis();
  const [typed, setTyped] = useState("");
  const [played, setPlayed] = useState(false);
  const doneRef = useRef(false);

  const play = () => {
    if (played) return;
    synth.speak(question.audioText || question.answer, 1);
    setPlayed(true);
  };

  const submit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const g = gradeDictation(question.answer, typed);
    recordAttempt({
      qid: question.id,
      taskType: "wfd",
      mode: "manual",
      score: g.score,
      wpm: null,
      durationMs: 0,
      metrics: { hits: g.hits, missed: g.missed, extras: g.extras.length },
      tags: [EXAM_TAG],
    });
    onDone(g.score, "graded", typed);
  }, [typed, question, onDone]);

  useEffect(() => {
    registerSubmit(submit);
  }, [registerSubmit, submit]);

  const words = typed.trim() ? tokenize(typed).length : 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
      <p className="text-sm text-muted-foreground">
        Ouça a frase (1 reprodução) e digite exatamente o que ouviu.
      </p>
      <Button
        variant="outline"
        className="mt-4"
        onClick={play}
        disabled={played || !synth.supported}
      >
        {played ? "Já reproduzida" : "Ouvir frase"}
      </Button>
      <textarea
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        rows={4}
        placeholder="Digite a frase…"
        className="mt-4 w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring"
      />
      <p className="mt-2 text-xs text-muted-foreground tabular-nums">{words} palavra(s)</p>
    </div>
  );
}

// ---------- Widget: resumos (SWT / SST / lst_summary) ----------

function SummaryWidget({
  question,
  registerSubmit,
  onDone,
}: ExamWidgetProps & { question: SwtQuestion | SstQuestion | SummaryChoiceQuestion }) {
  const isWritten = question.taskType === "swt";
  const synth = useSpeechSynthesis();
  const [typed, setTyped] = useState("");
  const [played, setPlayed] = useState(false);
  const doneRef = useRef(false);

  const play = () => {
    if (played) return;
    synth.speak(question.transcript || question.audioText, 1);
    setPlayed(true);
  };

  const submit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const grade = isWritten
      ? gradeSwt(question.text, typed)
      : gradeSst(question.transcript || question.audioText, typed);
    recordAttempt({
      qid: question.id,
      taskType: question.taskType,
      mode: "manual",
      score: grade.score,
      wpm: null,
      durationMs: 0,
      metrics: { words: grade.words, coverage: grade.coverage },
      tags: [EXAM_TAG],
    });
    onDone(grade.score, "graded", typed.slice(0, 500));
  }, [isWritten, typed, question, onDone]);

  useEffect(() => {
    registerSubmit(submit);
  }, [registerSubmit, submit]);

  const words = typed.trim() ? tokenize(typed).length : 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
      {isWritten ? (
        <p className="font-serif text-[15px] leading-relaxed text-foreground/90">{question.text}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Ouça a palestra (1 reprodução) e escreva um resumo de 50–70 palavras.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={play}
            disabled={played || !synth.supported}
          >
            {played ? "Já reproduzida" : "Ouvir palestra"}
          </Button>
        </>
      )}
      <textarea
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        rows={6}
        placeholder="Escreva seu resumo…"
        className="mt-4 w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring"
      />
      <p className="mt-2 text-xs text-muted-foreground tabular-nums">{words} palavra(s)</p>
    </div>
  );
}

// ---------- Widget: FIB (lacunas inline) ----------

function FibWidget({
  question,
  registerSubmit,
  onDone,
}: ExamWidgetProps & { question: FibQuestion }) {
  const synth = useSpeechSynthesis();
  const [played, setPlayed] = useState(false);
  const segments = useMemo(() => parseFibSegments(question.text), [question.text]);
  const [inputs, setInputs] = useState<string[]>(() => question.answers.map(() => ""));
  const doneRef = useRef(false);

  const play = () => {
    if (played) return;
    synth.speak(question.audioText || question.transcript, 1);
    setPlayed(true);
  };

  const submit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const g = gradeFib(question.answers, inputs);
    recordAttempt({
      qid: question.id,
      taskType: "lst_fib",
      mode: "manual",
      score: g.score,
      wpm: null,
      durationMs: 0,
      metrics: { correct: g.correct, total: g.total },
      tags: [EXAM_TAG],
    });
    onDone(g.score, "graded", inputs.join(" "));
  }, [inputs, question, onDone]);

  useEffect(() => {
    registerSubmit(submit);
  }, [registerSubmit, submit]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
      <p className="text-sm text-muted-foreground">Ouça o áudio e preencha as lacunas.</p>
      <Button
        variant="outline"
        className="mt-4"
        onClick={play}
        disabled={played || !synth.supported}
      >
        {played ? "Já reproduzida" : "Ouvir áudio"}
      </Button>
      <p className="mt-5 font-serif text-[15px] leading-[2.4] text-foreground/90">
        {segments.map((seg, i) =>
          seg.kind === "text" ? (
            <span key={`t-${i}`}>{seg.word} </span>
          ) : (
            <input
              key={`b-${seg.index}`}
              value={inputs[seg.index] ?? ""}
              onChange={(e) =>
                setInputs((prev) => prev.map((v, k) => (k === seg.index ? e.target.value : v)))
              }
              aria-label={`Lacuna ${seg.index + 1}`}
              className="mx-0.5 w-28 rounded-md border border-input bg-background px-2 py-0.5 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            />
          ),
        )}
      </p>
    </div>
  );
}

// ---------- Widget: HIW (palavras incorretas) ----------

function HiwWidget({
  question,
  registerSubmit,
  onDone,
}: ExamWidgetProps & { question: HiwQuestion }) {
  const synth = useSpeechSynthesis();
  const [played, setPlayed] = useState(false);
  const tokens = useMemo(() => tokenize(question.text), [question.text]);
  const [clicked, setClicked] = useState<number[]>([]);
  const doneRef = useRef(false);

  const play = () => {
    if (played) return;
    synth.speak(question.audioText || question.transcript, 1);
    setPlayed(true);
  };

  const submit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const g = gradeHiw(clicked, question.errorIndexes);
    recordAttempt({
      qid: question.id,
      taskType: "lst_hiw",
      mode: "manual",
      score: g.percent,
      wpm: null,
      durationMs: 0,
      metrics: { hits: g.hits, falsePositives: g.falsePositives },
      tags: [EXAM_TAG],
    });
    const answer = clicked
      .map((i) => tokens[i])
      .filter(Boolean)
      .join(", ");
    onDone(g.percent, "graded", answer || undefined);
  }, [clicked, tokens, question, onDone]);

  useEffect(() => {
    registerSubmit(submit);
  }, [registerSubmit, submit]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
      <p className="text-sm text-muted-foreground">
        Ouça o áudio e clique nas palavras do texto que <strong>não</strong> aparecem nele.
      </p>
      <Button
        variant="outline"
        className="mt-4"
        onClick={play}
        disabled={played || !synth.supported}
      >
        {played ? "Já reproduzida" : "Ouvir áudio"}
      </Button>
      <p className="mt-5 font-serif text-[15px] leading-[2.2] text-foreground/90">
        {tokens.map((w, i) => (
          <button
            key={`w-${i}`}
            type="button"
            onClick={() =>
              setClicked((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))
            }
            className={cn(
              "mr-1 rounded px-0.5",
              clicked.includes(i) && "bg-destructive/15 text-destructive line-through",
            )}
          >
            {w}
          </button>
        ))}
      </p>
    </div>
  );
}

// ---------- Widget: MCQs (6 tipos de escolha) ----------

const AUDIO_CHOICE_TYPES = new Set(["lst_mcq", "lst_mcq_multi", "lst_hcs", "lst_smw"] as const);

function ChoiceWidget({
  question,
  registerSubmit,
  onDone,
}: ExamWidgetProps & { question: ChoiceQuestion }) {
  const isMulti = question.taskType === "mcq_multi" || question.taskType === "lst_mcq_multi";
  const hasAudio = AUDIO_CHOICE_TYPES.has(
    question.taskType as typeof AUDIO_CHOICE_TYPES extends Set<infer T> ? T : never,
  );
  const synth = useSpeechSynthesis();
  const [selected, setSelected] = useState<number[]>([]);
  const [played, setPlayed] = useState(false);
  const doneRef = useRef(false);

  const play = () => {
    if (played) return;
    synth.speak(question.audioText || question.transcript, 1);
    setPlayed(true);
  };

  const submit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const g = isMulti
      ? gradeMulti(selected, question.answer, question.options.length)
      : gradeSingle(selected[0] ?? null, question.answer);
    recordAttempt({
      qid: question.id,
      taskType: question.taskType,
      mode: "manual",
      score: g.score,
      wpm: null,
      durationMs: 0,
      metrics: { selected: selected.length, answers: question.answer.length },
      tags: [EXAM_TAG],
    });
    const answer = selected.map((i) => String.fromCharCode(65 + i)).join(", ");
    onDone(g.score, "graded", answer || undefined);
  }, [isMulti, selected, question, onDone]);

  useEffect(() => {
    registerSubmit(submit);
  }, [registerSubmit, submit]);

  const toggle = (i: number) => {
    setSelected((prev) => {
      if (!isMulti) return [i];
      return prev.includes(i) ? prev.filter((p) => p !== i) : [...prev, i];
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        {question.taskType === "lst_smw" ? (
          <p className="font-serif text-[15px] leading-relaxed text-foreground/90">
            {question.text}{" "}
            <span className="mx-0.5 inline-block w-24 border-b-2 border-dashed border-primary/60 align-baseline" />
          </p>
        ) : (
          <p className="font-serif text-[15px] leading-relaxed text-foreground/90">
            {question.text}
          </p>
        )}
        {hasAudio ? (
          <Button
            variant="outline"
            className="mt-4"
            onClick={play}
            disabled={played || !synth.supported}
          >
            {played ? "Já reproduzida" : "Ouvir gravação"}
          </Button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {isMulti ? "Marque todas as corretas (erro desconta)" : "Escolha uma"}
        </p>
        <div className="mt-3 space-y-2" role={isMulti ? "group" : "radiogroup"}>
          {question.options.map((opt, i) => (
            <button
              key={`opt-${i}`}
              type="button"
              role={isMulti ? "checkbox" : "radio"}
              aria-checked={selected.includes(i)}
              onClick={() => toggle(i)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                selected.includes(i)
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50",
              )}
            >
              <span className="mt-0.5 w-5 shrink-0 text-center text-xs">
                {selected.includes(i) ? (
                  <span className="text-primary">●</span>
                ) : (
                  <span className="text-muted-foreground/40">○</span>
                )}
              </span>
              <span className="shrink-0 font-serif font-semibold">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-foreground/90">{opt}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Widgets: Write Essay / Re-order / Reading FIB (fase 5) ----------

function EssayExamWidget({
  question,
  registerSubmit,
  onDone,
}: ExamWidgetProps & { question: WriteEssayQuestion }) {
  const [typed, setTyped] = useState("");
  const doneRef = useRef(false);
  const words = typed.trim() ? typed.trim().split(/\s+/).length : 0;

  const submit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const g = gradeEssay(typed, question.sample);
    recordAttempt({
      qid: question.id,
      taskType: "write_essay",
      mode: "manual",
      score: g.score,
      wpm: null,
      durationMs: 0,
      metrics: { words: g.words, paragraphs: g.paragraphs },
      tags: [EXAM_TAG],
    });
    onDone(g.score, "graded", typed.slice(0, 500));
  }, [typed, question, onDone]);

  useEffect(() => {
    registerSubmit(submit);
  }, [registerSubmit, submit]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
      <p className="text-sm text-muted-foreground">
        Escreva a redação completa: 200-300 palavras, 20 minutos no relógio do bloco.
      </p>
      <p className="mt-3 font-serif text-[15px] leading-relaxed">
        {question.prompt || question.text}
      </p>
      <textarea
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        rows={10}
        placeholder="Sua redação…"
        className="mt-4 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-ring"
      />
      <p
        className={cn(
          "mt-2 text-xs tabular-nums",
          words >= 200 && words <= 300 ? "text-success" : "text-muted-foreground",
        )}
      >
        {words} / 200-300 palavras
      </p>
    </div>
  );
}

function ReorderExamWidget({
  question,
  registerSubmit,
  onDone,
}: ExamWidgetProps & { question: ReorderQuestion }) {
  const [order, setOrder] = useState<number[]>(() => question.items.map((_, i) => i));
  const doneRef = useRef(false);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const it = next.splice(from, 1)[0];
    if (it === undefined) return;
    next.splice(to, 0, it);
    setOrder(next);
  };

  const submit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const g = gradeReorder(order, question.correctOrder, question);
    recordAttempt({
      qid: question.id,
      taskType: "reorder_paragraphs",
      mode: "manual",
      score: g.score,
      wpm: null,
      durationMs: 0,
      metrics: { pairs: g.pairsCorrect, total: g.pairsTotal },
      tags: [EXAM_TAG],
    });
    const answer = order.map((i) => question.items[i]?.slice(0, 60)).join(" | ");
    onDone(g.score, "graded", answer || undefined);
  }, [order, question, onDone]);

  useEffect(() => {
    registerSubmit(submit);
  }, [registerSubmit, submit]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
      <p className="text-sm text-muted-foreground">
        Reordene os trechos para formar um parágrafo coerente.
      </p>
      <ul className="mt-4 space-y-2">
        {order.map((itemIdx, pos) => (
          <li
            key={itemIdx}
            className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm"
          >
            <span className="mt-0.5 shrink-0 tabular-nums text-muted-foreground">{pos + 1}.</span>
            <span className="min-w-0 flex-1">{question.items[itemIdx]}</span>
            <span className="flex shrink-0 flex-col gap-0.5">
              <button
                type="button"
                aria-label="Mover para cima"
                className="rounded px-1.5 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-30"
                disabled={pos === 0}
                onClick={() => move(pos, pos - 1)}
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="Mover para baixo"
                className="rounded px-1.5 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-30"
                disabled={pos === order.length - 1}
                onClick={() => move(pos, pos + 1)}
              >
                ▼
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FibDropdownExamWidget({
  question,
  registerSubmit,
  onDone,
}: ExamWidgetProps & { question: ReadFibQuestion }) {
  const [selections, setSelections] = useState<(string | null)[]>(() =>
    question.blanks.map(() => null),
  );
  const doneRef = useRef(false);

  const submit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const g = gradeDropdown(selections, question.blanks);
    recordAttempt({
      qid: question.id,
      taskType: "read_fib",
      mode: "manual",
      score: g.score,
      wpm: null,
      durationMs: 0,
      metrics: { correct: g.correct, total: g.total },
      tags: [EXAM_TAG],
    });
    onDone(g.score, "graded", selections.filter(Boolean).join(", ") || undefined);
  }, [selections, question, onDone]);

  useEffect(() => {
    registerSubmit(submit);
  }, [registerSubmit, submit]);

  const parts = question.text.split(/_{5,}\((\d+)\)/);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    nodes.push(<span key={`t${i}`}>{parts[i]}</span>);
    if (i + 1 < parts.length) {
      const blankIdx = Number(parts[i + 1]) - 1;
      const blank = question.blanks[blankIdx];
      if (!blank) continue;
      nodes.push(
        <select
          key={`b${blankIdx}`}
          value={selections[blankIdx] ?? ""}
          onChange={(e) =>
            setSelections((prev) => {
              const next = [...prev];
              next[blankIdx] = e.target.value || null;
              return next;
            })
          }
          className="mx-1 rounded-lg border border-input bg-background px-2 py-0.5 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="" disabled>
            —
          </option>
          {blank.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>,
      );
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
      <p className="text-sm text-muted-foreground">Escolha a palavra correta para cada lacuna.</p>
      <p className="mt-4 font-serif text-[15px] leading-loose">{nodes}</p>
    </div>
  );
}

// ---------- Runner ----------

function widgetFor(question: UnifiedQuestion, props: ExamWidgetProps) {
  switch (question.taskType) {
    // Fase 7: fala — o widget de fala cobre os 3 tipos novos no modo exame.
    case "read_aloud":
    case "repeat_sentence":
    case "retell_lecture":
    case "answer_short":
    case "summarize_group_discussion":
    case "respond_to_situation":
    case "describe_image":
      return <SpeechWidget key={question.id} question={question} {...props} />;
    case "wfd":
      return <DictationWidget key={question.id} question={question} {...props} />;
    case "swt":
    case "summarize_spoken_text":
    case "lst_summary":
      return <SummaryWidget key={question.id} question={question} {...props} />;
    case "lst_fib":
      return <FibWidget key={question.id} question={question} {...props} />;
    case "lst_hiw":
      return <HiwWidget key={question.id} question={question} {...props} />;
    case "write_essay":
      return <EssayExamWidget key={question.id} question={question} {...props} />;
    case "reorder_paragraphs":
      return <ReorderExamWidget key={question.id} question={question} {...props} />;
    case "read_fib":
      return <FibDropdownExamWidget key={question.id} question={question} {...props} />;
    default:
      return <ChoiceWidget key={question.id} question={question} {...props} />;
  }
}

const fmtClock = (s: number) =>
  `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

const CAUSE_LABEL: Record<ExamResultCause, string> = {
  graded: "Avaliada automaticamente",
  skipped: "Pulada por você",
  expired: "Tempo esgotado",
  technical: "Falha técnica (microfone/rede)",
  empty: "Sem resposta",
  not_gradable: "Não avaliável",
};

interface ReviewRow {
  qid: string;
  cause: ExamResultCause;
  prompt: string;
  answer: string;
  reference: string;
}

const promptFor = (q: UnifiedQuestion): string =>
  q.taskType === "read_aloud" || q.taskType === "repeat_sentence" ? q.text || q.prompt : q.prompt;

/** Gabarito em texto plano para a revisão pós-exame (§1.6). */
function referenceFor(q: UnifiedQuestion): string {
  switch (q.taskType) {
    case "read_aloud":
    case "describe_image":
    case "retell_lecture":
    case "summarize_group_discussion":
    case "respond_to_situation":
      return q.transcript || q.text;
    case "repeat_sentence":
      return q.answer || q.transcript;
    case "answer_short":
    case "wfd":
      return q.answer;
    case "swt":
    case "summarize_spoken_text":
    case "lst_summary":
      return q.sample || q.text;
    case "lst_fib":
      return q.answers.join(" · ");
    case "lst_hiw": {
      const tokens = tokenize(q.text);
      return q.errorIndexes
        .map((i) => tokens[i] ?? "")
        .filter(Boolean)
        .join(", ");
    }
    case "mcq_single":
    case "mcq_multi":
    case "lst_mcq":
    case "lst_mcq_multi":
    case "lst_hcs":
    case "lst_smw":
      return q.answer.map((i) => String.fromCharCode(65 + i)).join(", ") || "—";
    case "reorder_paragraphs":
      return q.correctOrder.map((i) => q.items[i] ?? "").join(" → ");
    case "read_fib":
      return q.blanks.map((b) => b.answer).join(" · ");
    default:
      return "—";
  }
}

function ExamReviewRow({
  cause,
  prompt,
  answer,
  reference,
}: {
  cause: ExamResultCause;
  prompt: string;
  answer: string;
  reference: string;
}) {
  return (
    <li className="space-y-1 py-3 first:pt-0">
      <p className="text-sm text-foreground">{prompt}</p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">Sua resposta:</span>{" "}
        <span className="italic">{answer || "—"}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">Referência:</span>{" "}
        <span className="italic">{reference}</span>
      </p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {CAUSE_LABEL[cause]}
      </p>
    </li>
  );
}

export function ExamRunner({ examId, onExit }: { examId: ExamId; onExit: () => void }) {
  const app = useAppState();
  const navigate = useNavigate();

  // Projeto 13 (§1.1/D5): a fila é ESTÁVEL — retomada usa a fila persistida;
  // um simulado novo sorteia UMA vez (mudar o filtro no meio não troca questões).
  const [boot] = useState(() => {
    const d = getExamDraft();
    const resume = d && d.examId === examId ? d : null;
    return {
      resume,
      queue:
        resume?.queue ??
        buildExamQueue(examId, Math.random, { verifiedOnly: app.settings.verifiedOnly }),
    };
  });
  const [queue, setQueue] = useState(boot.queue);
  const [index, setIndex] = useState(() => boot.resume?.index ?? 0);
  const [question, setQuestion] = useState<UnifiedQuestion | null>(null);
  const [results, setResults] = useState<ExamResultRow[]>(() => boot.resume?.results ?? []);
  const [phase, setPhase] = useState<"running" | "summary">(() => boot.resume?.phase ?? "running");
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // Relógio ABSOLUTO (§1.3): deadline por questão derivado de Date.now() —
  // aba suspensa ou fechada NÃO devolve tempo. null = relógio ainda não abriu.
  const [timer, setTimer] = useState<{ qid: string; deadlineAt: number } | null>(() =>
    boot.resume && boot.resume.deadlineAt > 0
      ? { qid: boot.resume.queue[boot.resume.index]!, deadlineAt: boot.resume.deadlineAt }
      : null,
  );
  const [now, setNow] = useState(() => Date.now());

  const submitRef = useRef<(() => void) | null>(null);
  const registerSubmit = useCallback((fn: () => void) => {
    submitRef.current = fn;
  }, []);
  const startedAt = useRef(boot.resume?.startedAt ?? Date.now());
  const handledRef = useRef(false);

  // Persiste o draft de um simulado NOVO (na retomada o draft já existe).
  useEffect(() => {
    if (boot.resume || queue.length === 0) return;
    if (getExamDraft()) return;
    saveExamDraft({
      examId,
      queue,
      index: 0,
      results: [],
      phase: "running",
      deadlineAt: 0,
      startedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  // Carrega a questão atual (import dinâmico por task type) com erro
  // RECOVERÁVEL (§1.2): falha nunca deixa o runner preso em "Carregando…".
  useEffect(() => {
    if (phase !== "running") return;
    let alive = true;
    const qid = queue[index];
    if (!qid) return;
    setQuestion(null);
    setLoadError(false);
    import("@/lib/pte")
      .then(({ loadQuestion }) => loadQuestion(qid))
      .then((q) => {
        if (alive) setQuestion(q ?? null);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [index, queue, phase, retryKey]);

  // Guard de submissão única por questão.
  useEffect(() => {
    if (!question) return;
    handledRef.current = false;
  }, [question]);

  // Deadline da questão: definido quando ela ABRE; na retomada, o deadline
  // persistido é mantido (o tempo longe do app conta — §1.3).
  useEffect(() => {
    if (phase !== "running" || !question) return;
    setTimer((t) => {
      if (t && t.qid === question.id) return t;
      return { qid: question.id, deadlineAt: Date.now() + examTiming(question.taskType) * 1000 };
    });
  }, [question, phase]);

  // Tick: recalcula a partir do deadline absoluto (não decrementa acumulador).
  useEffect(() => {
    if (phase !== "running" || !timer) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [phase, timer]);

  // Persiste o deadline no draft (retomável após reload).
  useEffect(() => {
    if (!timer) return;
    const d = getExamDraft();
    if (!d || d.examId !== examId || d.deadlineAt === timer.deadlineAt) return;
    saveExamDraft({ ...d, deadlineAt: timer.deadlineAt });
  }, [timer, examId]);

  const secondsLeft = timer ? Math.max(0, Math.ceil((timer.deadlineAt - now) / 1000)) : null;

  // Auto-submit ao zerar o relógio da questão.
  useEffect(() => {
    if (phase !== "running" || secondsLeft === null || secondsLeft > 0) return;
    submitRef.current?.();
  }, [secondsLeft, phase]);

  const handleDone = useCallback(
    (score: number | null, cause?: ExamResultCause, answer?: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      const qid = queue[index]!;
      const row: ExamResultRow = {
        qid,
        score,
        ...(cause !== undefined ? { cause } : {}),
        ...(answer ? { answer } : {}),
      };
      const nextResults: ExamResultRow[] = [...results, row];
      setResults(nextResults);
      const d = getExamDraft();
      if (index + 1 >= queue.length) {
        addSessionRecord({
          startedAt: startedAt.current,
          finishedAt: Date.now(),
          kind: "exam",
          label: examLabel(examId),
          results: nextResults.map((r) => ({ qid: r.qid, score: r.score, wpm: null })),
        });
        if (d && d.examId === examId) clearExamDraft();
        setPhase("summary");
      } else {
        const nextIndex = index + 1;
        setIndex(nextIndex);
        // deadlineAt 0 = relógio ainda não abriu para a próxima questão.
        if (d && d.examId === examId) {
          saveExamDraft({ ...d, index: nextIndex, results: nextResults, deadlineAt: 0 });
        }
      }
    },
    [examId, index, queue, results],
  );

  // Retomada com o tempo já esgotado (§1.1): a questão é registrada como não
  // avaliada (tempo esgotado) e o simulado segue — uma única vez, no mount.
  const expiredRef = useRef(false);
  useEffect(() => {
    const r = boot.resume;
    if (!r || phase !== "running" || expiredRef.current) return;
    if (r.deadlineAt <= 0 || r.deadlineAt > Date.now()) return;
    expiredRef.current = true;
    handleDone(null, "expired");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retomada em ponto inconsistente (ex.: índice além da fila): trata como
  // concluído — nunca deixa o runner preso sem questão.
  useEffect(() => {
    const r = boot.resume;
    if (!r || r.index < r.queue.length) return;
    clearExamDraft();
    setPhase("summary");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stepper (visual): blocos contíguos de seção na fila real — sem navegação própria.
  // (hook acima do early return de resumo: hooks têm de rodar em todo render)
  const steps = useMemo(() => {
    const out: { label: string; from: number; to: number }[] = [];
    for (let i = 0; i < queue.length; i++) {
      const q = getMeta(queue[i]);
      const label = q ? SECTION_META[q.section].label : "—";
      const last = out[out.length - 1];
      if (last && last.label === label) last.to = i;
      else out.push({ label, from: i, to: i });
    }
    return out;
  }, [queue]);

  const errorQids = examReviewQids(results);
  // Revisão pós-exame (§1.6): o que foi enviado, com a causa e a referência.
  // O conteúdo da questão vem do banco — carregamento assíncrono.
  const reviewRows = useMemo(
    () => results.filter((r) => r.cause && !(r.cause === "graded" && !r.answer)),
    [results],
  );
  const [review, setReview] = useState<ReviewRow[]>([]);
  useEffect(() => {
    let alive = true;
    void import("@/lib/pte")
      .then(async ({ loadQuestion }) => {
        const rows: ReviewRow[] = [];
        for (const r of reviewRows) {
          const q = await loadQuestion(r.qid);
          if (!q || !r.cause) continue;
          rows.push({
            qid: r.qid,
            cause: r.cause,
            prompt: promptFor(q).slice(0, 200),
            answer: (r.answer ?? "").slice(0, 300),
            reference: referenceFor(q).slice(0, 300),
          });
        }
        if (alive) setReview(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [reviewRows]);

  if (phase === "summary") {
    const summary = gradeExamSummary(results, app.attempts);
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <TopNav />
        <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
          <PageHeader kicker={`${examLabel(examId)} · concluído`} title="Resumo do simulado" />
          <section
            aria-label="Média do simulado"
            className="rounded-2xl border border-border/60 bg-card bg-glow p-6 shadow-card sm:p-8"
          >
            <StatHero
              value={summary.overall !== null ? `${summary.overall}%` : "—"}
              label="Média de conteúdo"
              hint={
                summary.notEvaluated > 0
                  ? `${summary.gradedCount} de ${summary.totalCount} questão(ões) com correção automática · ${summary.notEvaluated} não avaliada(s) fora da média.`
                  : `${summary.gradedCount} de ${summary.totalCount} questão(ões) com correção automática.`
              }
            />
          </section>

          {summary.notEvaluated > 0 ? (
            <section
              aria-label="Questões não avaliadas"
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-card"
            >
              <h2 className="text-sm font-medium text-muted-foreground">
                Não avaliadas ({summary.notEvaluated})
              </h2>
              <p className="mt-2 text-sm text-foreground/80">
                {summary.notEvaluated === 1
                  ? "1 questão ficou sem correção automática (falha técnica, tempo esgotado ou sem resposta) e não entra na média."
                  : `${summary.notEvaluated} questões ficaram sem correção automática (falha técnica, tempo esgotado ou sem resposta) e não entram na média.`}
              </p>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h2 className="text-sm font-medium text-muted-foreground">Média por seção</h2>
            <div className="mt-4 space-y-2">
              {summary.bySection.map((s) => (
                <div key={s.section} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{s.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        s.avg === null
                          ? "bg-muted-foreground/30"
                          : s.avg >= 90
                            ? "bg-success"
                            : s.avg >= 70
                              ? "bg-warning"
                              : "bg-destructive",
                      )}
                      style={{ width: `${s.avg ?? 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs tabular-nums">
                    {s.avg !== null ? `${s.avg}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {summary.bySkill.some((s) => s.avg !== null || s.practiceAvg !== null) ? (
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
              <h2 className="text-sm font-medium text-muted-foreground">
                Por habilidade (vs. prática livre)
              </h2>
              <ul className="mt-3 divide-y divide-border/50 text-sm">
                {summary.bySkill.map((s) => (
                  <li key={s.skill} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{s.label}</span>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {s.avg !== null ? `${s.avg}%` : "—"}
                      {s.practiceAvg !== null ? ` · prática ${s.practiceAvg}%` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {summary.byType.length > 0 ? (
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
              <h2 className="text-sm font-medium text-muted-foreground">
                Por task type (vs. prática livre)
              </h2>
              <ul className="mt-3 divide-y divide-border/50 text-sm">
                {summary.byType.map((t) => (
                  <li key={t.taskType} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{t.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {t.avg !== null ? `${t.avg}%` : "—"}
                      {t.practiceAvg !== null ? (
                        <span
                          className={cn(
                            "ml-2",
                            t.avg !== null && t.avg >= t.practiceAvg
                              ? "text-success"
                              : "text-destructive",
                          )}
                        >
                          {t.avg !== null && t.avg >= t.practiceAvg ? "▲" : "▼"} {t.practiceAvg}%
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {summary.weakest.length > 0 ? (
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
              <h2 className="text-sm font-medium text-muted-foreground">Pontos fracos</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.weakest.map((t) => (
                  <span
                    key={t.taskType}
                    className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs"
                  >
                    {t.label} · {t.avg}%
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {review.length > 0 ? (
            <section
              aria-label="Revisão das respostas enviadas"
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-card"
            >
              <h2 className="text-sm font-medium text-muted-foreground">
                Respostas enviadas ({review.length})
              </h2>
              <ul className="mt-1 divide-y divide-border/50">
                {review.map((r) => (
                  <ExamReviewRow
                    key={r.qid}
                    cause={r.cause}
                    prompt={r.prompt}
                    answer={r.answer}
                    reference={r.reference}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {errorQids.length > 0 ? (
              <Button
                size="lg"
                onClick={() => {
                  startErrorsSessionForQids(errorQids);
                  navigate({ to: "/practice" });
                }}
              >
                Criar sessão de erros ({errorQids.length})
              </Button>
            ) : null}
            <Button size="lg" onClick={onExit}>
              Fazer outro simulado
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate({ to: "/" })}>
              Voltar ao início
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const total = queue.length;
  const current = index + 1;
  const metaNow = getMeta(queue[index]);
  const displaySeconds = secondsLeft ?? (metaNow ? examTiming(metaNow.taskType) : 60);
  const urgent = secondsLeft !== null && secondsLeft <= 10;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 sm:px-6">
        {/* Cabeçalho: o protagonista é a questão; relógio e progresso são auxiliares */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 pt-5">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              {examLabel(examId)}
            </h1>
            <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
              Questão {current} de {total} · modo simulado — sem correção imediata
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 font-mono text-sm tabular-nums",
              urgent ? "bg-destructive/10 font-semibold text-destructive" : "bg-secondary",
            )}
            role="timer"
            aria-label={`Tempo restante desta questão: ${fmtClock(displaySeconds)}`}
            aria-live="off"
            aria-atomic="true"
          >
            {fmtClock(displaySeconds)}
          </span>
        </div>
        {urgent ? (
          <p role="status" className="mb-3 text-xs font-semibold text-destructive">
            Tempo acabando — a questão é enviada ao zerar o cronômetro.
          </p>
        ) : null}

        {/* Stepper das etapas por seção */}
        {steps.length > 1 ? (
          <ol
            aria-label="Etapas do simulado"
            className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          >
            {steps.map((s, i) => {
              const done = index > s.to;
              const active = index >= s.from && index <= s.to;
              return (
                <li
                  key={i}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs",
                    active
                      ? "bg-primary font-medium text-primary-foreground"
                      : done
                        ? "bg-secondary text-muted-foreground"
                        : "bg-secondary/60 text-muted-foreground/80",
                  )}
                >
                  {done ? (
                    <Check className="size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        active ? "bg-primary-foreground" : "bg-muted-foreground/50",
                      )}
                    />
                  )}
                  <span className="truncate">{s.label}</span>
                  <span className="sr-only">
                    {done ? " — concluída" : active ? " — etapa atual" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}

        {queue.length === 0 ? (
          <div role="alert" className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
            <h2 className="font-serif text-xl font-semibold">Sem questões elegíveis</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O filtro “Só fontes verificadas” esvaziou o pool deste simulado. Desligue o filtro
              para treinar com todas as fontes ou volte para escolher outra modalidade.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  updateSettings({ verifiedOnly: false });
                  setQueue(buildExamQueue(examId, Math.random, { verifiedOnly: false }));
                }}
              >
                Usar todas as fontes
              </Button>
              <Button variant="outline" onClick={onExit}>
                Voltar
              </Button>
            </div>
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
            <h2 className="font-serif text-xl font-semibold">
              Não foi possível carregar a questão
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O conteúdo desta questão não abriu (falha de rede ou leitura). Seu progresso está
              salvo — tente de novo ou saia sem perder o simulado.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setRetryKey((k) => k + 1)}>Tentar novamente</Button>
              <Button variant="outline" onClick={onExit}>
                Sair do simulado
              </Button>
            </div>
          </div>
        ) : question ? (
          widgetFor(question, { registerSubmit, onDone: handleDone })
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground shadow-card"
          >
            Carregando questão… (o cronômetro começa quando ela abre)
          </div>
        )}
      </main>

      {/* Rodapé em fluxo (sticky acima da TabBar mobile) — emulado fixo no desktop */}
      <footer className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 mt-auto border-t border-border/70 bg-background/95 backdrop-blur md:bottom-0">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="text-sm text-muted-foreground">
            Ao zerar o tempo, a questão é enviada automaticamente. Sem pausa durante o simulado.
          </div>
          <Button variant="ghost" className="min-h-11" onClick={() => handleDone(null, "skipped")}>
            Pular questão
          </Button>
        </div>
      </footer>
    </div>
  );
}
