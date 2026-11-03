import { BookOpen, Headphones, Mic, PenLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Section } from "@/lib/pte/types";
import { cn } from "@/lib/utils";

/**
 * Identidade visual por seção (PRD §8): ícone + cor semântica derivados dos
 * tokens --section-* / --color-section-*. Toda superfície que representa uma
 * seção usa isto — nunca cor avulsa.
 */
export const SECTION_ICONS: Record<Section, LucideIcon> = {
  speaking: Mic,
  writing: PenLine,
  reading: BookOpen,
  listening: Headphones,
};

/** Classe de cor do texto/ícone (ex.: `text-section-speaking`). */
export const SECTION_TEXT: Record<Section, string> = {
  speaking: "text-section-speaking",
  writing: "text-section-writing",
  reading: "text-section-reading",
  listening: "text-section-listening",
};

/** Classe de fundo suave da seção (ex.: `bg-section-speaking/10`). */
export const SECTION_BG: Record<Section, string> = {
  speaking: "bg-section-speaking/10",
  writing: "bg-section-writing/10",
  reading: "bg-section-reading/10",
  listening: "bg-section-listening/10",
};

interface SectionIconProps {
  section: Section;
  /** Tamanho do "chip" que envolve o ícone. */
  size?: "sm" | "md";
  className?: string;
}

export function SectionIcon({ section, size = "md", className }: SectionIconProps) {
  const Icon = SECTION_ICONS[section];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl",
        size === "md" ? "size-11" : "size-8",
        SECTION_BG[section],
        SECTION_TEXT[section],
        className,
      )}
    >
      <Icon className={size === "md" ? "size-5" : "size-4"} strokeWidth={2} />
    </span>
  );
}
