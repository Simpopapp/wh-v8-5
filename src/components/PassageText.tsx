import type { WordMark } from "@/lib/scoring";
import { cn } from "@/lib/utils";

interface PassageTextProps {
  words: string[];
  /** Quando presente, renderiza o mapa de correção (hit/missed/substituted/moved). */
  marks: WordMark[] | undefined;
  compact?: boolean;
  /** Modo manual: toque nas palavras para marcar/desmarcar erros. */
  onWordClick?: ((index: number) => void) | undefined;
}

const markClasses: Record<WordMark["status"], string> = {
  hit: "text-foreground",
  missed: "text-muted-foreground/60 line-through decoration-destructive/70 decoration-2",
  substituted: "text-warning",
  moved: "text-info underline decoration-dotted",
};

export function PassageText({ words, marks, compact, onWordClick }: PassageTextProps) {
  return (
    <p
      className={cn(
        "font-serif leading-[1.75] tracking-[0.01em] text-balance",
        compact ? "text-lg leading-relaxed md:text-xl" : "text-[26px] md:text-[30px]",
      )}
    >
      {words.map((word, i) => {
        const mark = marks?.[i];
        return (
          <span
            key={`${word}-${i}`}
            role={onWordClick ? "button" : undefined}
            tabIndex={onWordClick ? 0 : undefined}
            onClick={onWordClick ? () => onWordClick(i) : undefined}
            onKeyDown={
              onWordClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onWordClick(i);
                    }
                  }
                : undefined
            }
            className={cn(
              "inline-block whitespace-pre",
              mark && "word-mark rounded-sm px-0.5",
              mark && markClasses[mark.status],
              onWordClick && "cursor-pointer rounded-sm px-0.5 hover:bg-secondary",
            )}
            style={mark ? { animationDelay: `${Math.min(i * 18, 900)}ms` } : undefined}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}
