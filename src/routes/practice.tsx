import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import { TopNav } from "@/components/TopNav";
import { allMeta, firstIdOfType, loadQuestion } from "@/lib/pte";

// Cada motor vira um chunk próprio: abrir uma questão baixa só o motor + os dados do seu task type.
const ReadAloudPractice = lazy(() =>
  import("@/components/practice/ReadAloudPractice").then((m) => ({ default: m.ReadAloudPractice })),
);
const RepeatSentencePractice = lazy(() =>
  import("@/components/practice/RepeatSentencePractice").then((m) => ({
    default: m.RepeatSentencePractice,
  })),
);
const RetellLecturePractice = lazy(() =>
  import("@/components/practice/RetellLecturePractice").then((m) => ({
    default: m.RetellLecturePractice,
  })),
);
const AnswerShortPractice = lazy(() =>
  import("@/components/practice/AnswerShortPractice").then((m) => ({
    default: m.AnswerShortPractice,
  })),
);
const WfdPractice = lazy(() =>
  import("@/components/practice/WfdPractice").then((m) => ({ default: m.WfdPractice })),
);
const FibPractice = lazy(() =>
  import("@/components/practice/FibPractice").then((m) => ({ default: m.FibPractice })),
);
const HiwPractice = lazy(() =>
  import("@/components/practice/HiwPractice").then((m) => ({ default: m.HiwPractice })),
);
const McqPractice = lazy(() =>
  import("@/components/practice/McqPractice").then((m) => ({ default: m.McqPractice })),
);
const SwtPractice = lazy(() =>
  import("@/components/practice/SwtPractice").then((m) => ({ default: m.SwtPractice })),
);
const WriteEssayPractice = lazy(() =>
  import("@/components/practice/WriteEssayPractice").then((m) => ({
    default: m.WriteEssayPractice,
  })),
);
const ReorderPractice = lazy(() =>
  import("@/components/practice/ReorderPractice").then((m) => ({ default: m.ReorderPractice })),
);
const FibDropdownPractice = lazy(() =>
  import("@/components/practice/FibDropdownPractice").then((m) => ({
    default: m.FibDropdownPractice,
  })),
);
const SstPractice = lazy(() =>
  import("@/components/practice/SstPractice").then((m) => ({ default: m.SstPractice })),
);
const SgdPractice = lazy(() =>
  import("@/components/practice/SgdPractice").then((m) => ({ default: m.SgdPractice })),
);
const RespondSituationPractice = lazy(() =>
  import("@/components/practice/RespondSituationPractice").then((m) => ({
    default: m.RespondSituationPractice,
  })),
);
const DescribeImagePractice = lazy(() =>
  import("@/components/practice/DescribeImagePractice").then((m) => ({
    default: m.DescribeImagePractice,
  })),
);
const SoonPractice = lazy(() =>
  import("@/components/practice/SoonPractice").then((m) => ({ default: m.SoonPractice })),
);

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { q?: string | undefined } = {};
    const q = search["q"];
    if (typeof q === "string" && q) out.q = q;
    return out;
  },
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => {
    const question = await loadQuestion(deps.q);
    if (!question) {
      // sem q ou id inexistente → primeira questão (Read Aloud)
      const first = firstIdOfType("read_aloud") ?? allMeta[0]?.id;
      throw redirect({ to: "/practice", search: first ? { q: first } : {}, replace: true });
    }
    return { question };
  },
  head: () => ({
    meta: [
      { title: "Praticar — PTE Master Hub" },
      {
        name: "description",
        content:
          "Treino por task type: Read Aloud, Write From Dictation, MCQs de Reading e Listening, Highlight Incorrect Words, Summaries e mais.",
      },
      { property: "og:title", content: "Praticar — PTE Master Hub" },
      {
        property: "og:description",
        content:
          "Treino por task type: Read Aloud, Write From Dictation, MCQs de Reading e Listening, Highlight Incorrect Words, Summaries e mais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: PracticeLoading,
  component: PracticePage,
});

function PracticeLoading() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
        {/* Geometria estável: header + estímulo + ações (projeto 12, S1). */}
        <p role="status" aria-live="polite" className="sr-only">
          Carregando questão…
        </p>
        <div aria-hidden className="space-y-4">
          <div className="h-40 rounded-2xl border border-border/60 bg-card shadow-card motion-safe:animate-pulse" />
          <div className="min-h-[22rem] rounded-2xl border border-border/60 bg-card shadow-card motion-safe:animate-pulse" />
          <div className="h-16 rounded-2xl border border-border/60 bg-card shadow-card motion-safe:animate-pulse" />
        </div>
      </main>
    </div>
  );
}

/** Despacha a prática para o motor do taskType da questão carregada. */
function PracticePage() {
  const { question } = Route.useLoaderData();
  return <Suspense fallback={<PracticeLoading />}>{engineFor(question)}</Suspense>;
}

function engineFor(question: Awaited<ReturnType<typeof loadQuestion>> & object) {
  switch (question.taskType) {
    case "read_aloud":
      return <ReadAloudPractice key={question.id} question={question} />;
    case "repeat_sentence":
      return <RepeatSentencePractice key={question.id} question={question} />;
    case "retell_lecture":
      return <RetellLecturePractice key={question.id} question={question} />;
    case "answer_short":
      return <AnswerShortPractice key={question.id} question={question} />;
    case "wfd":
      return <WfdPractice key={question.id} question={question} />;
    case "lst_fib":
      return <FibPractice key={question.id} question={question} />;
    case "lst_hiw":
      return <HiwPractice key={question.id} question={question} />;
    case "mcq_single":
    case "mcq_multi":
    case "lst_mcq":
    case "lst_mcq_multi":
    case "lst_hcs":
    case "lst_smw":
      return <McqPractice key={question.id} question={question} />;
    case "swt":
      return <SwtPractice key={question.id} question={question} />;
    case "write_essay":
      return <WriteEssayPractice key={question.id} question={question} />;
    case "reorder_paragraphs":
      return <ReorderPractice key={question.id} question={question} />;
    case "read_fib":
      return <FibDropdownPractice key={question.id} question={question} />;
    case "summarize_spoken_text":
    case "lst_summary":
      return <SstPractice key={question.id} question={question} />;
    case "summarize_group_discussion":
      return <SgdPractice key={question.id} question={question} />;
    case "respond_to_situation":
      return <RespondSituationPractice key={question.id} question={question} />;
    case "describe_image":
      return <DescribeImagePractice key={question.id} question={question} />;
    default:
      return <SoonPractice key={(question as { id: string }).id} question={question} />;
  }
}
