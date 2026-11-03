import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/layout/EmptyState";
import { SECTION_ICONS } from "@/components/layout/SectionIdentity";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { Button } from "@/components/ui/button";
import { SECTION_META, TYPE_META, metaByType, type UnifiedQuestion } from "@/lib/pte";

/** Placeholder para tipos ainda sem motor implementado (modo preview do shell). */
export function SoonPractice({ question }: { question: UnifiedQuestion }) {
  const meta = TYPE_META[question.taskType];
  const SectionIcon = SECTION_ICONS[meta.section];
  return (
    <PracticeShell
      question={question}
      pool={metaByType(question.taskType)}
      title="Este tipo de prática chega em breve"
      mode="preview"
    >
      <EmptyState
        icon={SectionIcon}
        title={meta.label}
        description="Estamos construindo o motor desta seção. Enquanto isso, a pergunta é exibida abaixo para estudo livre."
        action={
          <Button asChild>
            <Link to={`/${meta.section}`}>Voltar à seção</Link>
          </Button>
        }
      />
      <p className="mt-6 text-left font-serif text-[15px] leading-relaxed text-foreground/90">
        {question.text}
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        {SECTION_META[meta.section].label} — este texto não é corrigido automaticamente.
      </p>
    </PracticeShell>
  );
}
