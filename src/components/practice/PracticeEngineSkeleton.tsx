import { TYPE_META, type TaskType } from "@/lib/pte";

/**
 * Skeleton por família de motor (projeto 13, §4.4.1): geometria aproximada do
 * motor que vai montar, sem carregar o módulo do engine. aria-hidden + status
 * para leitores de tela.
 */
type Family = "oral" | "audio" | "text" | "gaps" | "choice" | "reorder" | "neutral";

const FAMILY_BY_TYPE: Partial<Record<TaskType, Family>> = {
  read_aloud: "oral",
  repeat_sentence: "oral",
  retell_lecture: "audio",
  answer_short: "audio",
  describe_image: "oral",
  summarize_group_discussion: "audio",
  respond_to_situation: "oral",
  wfd: "text",
  write_essay: "text",
  swt: "text",
  summarize_spoken_text: "text",
  lst_summary: "text",
  lst_fib: "gaps",
  read_fib: "gaps",
  lst_hiw: "gaps",
  mcq_single: "choice",
  mcq_multi: "choice",
  lst_mcq: "choice",
  lst_mcq_multi: "choice",
  lst_hcs: "choice",
  lst_smw: "choice",
  reorder_paragraphs: "reorder",
};

const CARD = "rounded-2xl border border-border/60 bg-card shadow-card motion-safe:animate-pulse";

function FamilyGeometry({ family }: { family: Family }) {
  if (family === "oral") {
    return (
      <div aria-hidden className="space-y-4">
        <div className={`${CARD} h-16 p-4`}>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-secondary" />
            <div className="h-3 w-24 rounded-full bg-secondary" />
          </div>
        </div>
        <div className={`${CARD} min-h-[10rem] p-5`}>
          <div className="h-3 w-3/4 rounded-full bg-secondary" />
          <div className="mt-2 h-3 w-2/3 rounded-full bg-secondary" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-secondary" />
        </div>
        <div className={`${CARD} h-14`} />
      </div>
    );
  }
  if (family === "audio" || family === "text") {
    return (
      <div aria-hidden className="space-y-4">
        <div className={`${CARD} h-14`} />
        <div className={`${CARD} min-h-[14rem] p-5`}>
          <div className="h-3 w-full rounded-full bg-secondary" />
          <div className="mt-2 h-3 w-11/12 rounded-full bg-secondary" />
          <div className="mt-2 h-3 w-4/5 rounded-full bg-secondary" />
          <div className="mt-2 h-3 w-2/3 rounded-full bg-secondary" />
        </div>
        <div className={`${CARD} min-h-[8rem] p-5`}>
          <div className="h-3 w-1/3 rounded-full bg-secondary" />
          <div className="mt-3 h-16 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }
  if (family === "gaps") {
    return (
      <div aria-hidden className="space-y-4">
        <div className={`${CARD} min-h-[10rem] p-5`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-3 w-20 rounded-full bg-secondary" />
            <div className="h-8 w-24 rounded-lg bg-secondary" />
            <div className="h-3 w-16 rounded-full bg-secondary" />
            <div className="h-8 w-20 rounded-lg bg-secondary" />
            <div className="h-3 w-24 rounded-full bg-secondary" />
          </div>
          <div className="mt-3 h-3 w-3/4 rounded-full bg-secondary" />
        </div>
        <div className={`${CARD} h-24 p-4`}>
          <div className="h-8 w-28 rounded-lg bg-secondary" />
        </div>
      </div>
    );
  }
  if (family === "choice") {
    return (
      <div aria-hidden className="space-y-4">
        <div className={`${CARD} min-h-[8rem] p-5`}>
          <div className="h-3 w-3/4 rounded-full bg-secondary" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-secondary" />
        </div>
        <div className={`${CARD} space-y-3 p-5`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-5 rounded-full bg-secondary" />
              <div className="h-3 w-2/3 rounded-full bg-secondary" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (family === "reorder") {
    return (
      <div aria-hidden className="space-y-4">
        <div className={`${CARD} space-y-3 p-5`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-secondary" />
          ))}
        </div>
        <div className={`${CARD} h-14`} />
      </div>
    );
  }
  return (
    <div aria-hidden className="space-y-4">
      <div className={`${CARD} h-40`} />
      <div className={`${CARD} min-h-[22rem]`} />
      <div className={`${CARD} h-16`} />
    </div>
  );
}

export function PracticeEngineSkeleton({ taskType }: { taskType?: TaskType }) {
  const family = (taskType && FAMILY_BY_TYPE[taskType]) || "neutral";
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <p role="status" aria-live="polite" className="sr-only">
        Carregando questão{taskType ? ` de ${TYPE_META[taskType].label}` : ""}…
      </p>
      <div aria-hidden className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
        <div className={`${CARD} mb-5 h-32 p-5`}>
          <div className="h-3 w-28 rounded-full bg-secondary" />
          <div className="mt-3 h-6 w-56 rounded-full bg-secondary" />
        </div>
        <FamilyGeometry family={family} />
      </div>
    </div>
  );
}
