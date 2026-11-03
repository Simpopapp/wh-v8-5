import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface TranslationSheetProps {
  open: boolean;
  onClose: () => void;
  /** Palavra ou rótulo curto ("Frase") em destaque no cabeçalho. */
  title: string;
  /** Linha pequena acima do título (ex.: "Studie Plus"). */
  kicker?: string;
  /** Extras do cabeçalho (chip de mecanismo, etc.). */
  headerExtra?: ReactNode;
  /** Conteúdo do card (tradução, skeleton, estado vazio…). */
  children: ReactNode;
  /** Rodapé (ex.: pill "Salvo no vocabulário"). */
  footer?: ReactNode;
  ariaLabel: string;
  /** Ref para o painel — o chamador usa para ignorar toques dentro do sheet. */
  panelRef?: RefObject<HTMLDivElement | null>;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Container universal dos cards de tradução do Studie Plus (PRD projeto 12, §5):
 * posição padronizada na tela — bottom sheet no mobile, painel centralizado no
 * desktop — em vez de um balão ancorado ao ponto de clique (D1/D2). É um
 * container só de apresentação: os dados, o mecanismo (IA/dicionário) e a
 * captura no vocabulário continuam nas funções existentes.
 *
 * Fecha por ✕, Esc ou toque no scrim. Projeto 13 (§0.3/D10): é um MODAL de
 * verdade — o próprio sheet captura o foco, contém Tab/Shift+Tab dentro do
 * painel, congela o conteúdo atrás (inert) e devolve o foco ao gatilho ao
 * fechar (a menos que o gatilho capturado seja o body — aí o chamador
 * continua responsável pelo foco do token, como no projeto 12).
 */
export function TranslationSheet({
  open,
  onClose,
  title,
  kicker,
  headerExtra,
  children,
  footer,
  ariaLabel,
  panelRef,
}: TranslationSheetProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const ref = panelRef ?? localRef;
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const prevInertRef = useRef<{ el: Element; value: string }[] | null>(null);

  useEffect(() => {
    if (!open) return;

    // Foco: captura o gatilho, foca o painel e congela o conteúdo atrás.
    prevFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = setTimeout(() => ref.current?.focus(), 0);

    // Congela TODO o conteúdo atrás (inclusive TabBar/banner) — só o sheet
    // e o scrim ficam interativos enquanto o modal está aberto (D10).
    const inertTargets: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      const tag = (el as HTMLElement).tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK") continue;
      if (el.contains(ref.current)) continue;
      inertTargets.push(el);
    }
    prevInertRef.current = inertTargets.map((el) => ({
      el,
      value: el.getAttribute("inert") ?? "",
    }));
    for (const el of inertTargets) el.setAttribute("inert", "");

    // Modal de verdade (D10): Tab cíclico dentro do painel, Esc fecha.
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const focusables = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const inside = focusables.includes(e.target as HTMLElement);
      if (!inside) {
        e.preventDefault();
        focusables[0]!.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || active === ref.current) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || active === ref.current) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(timer);
      // Devolve o foco ao gatilho e descongela o conteúdo atrás. O foco só é
      // restaurado quando o elemento capturado continua válido e não é o
      // body (clique de mouse não foca o token — o chamador cuida dele).
      for (const { el, value } of prevInertRef.current ?? []) {
        if (value === "") el.removeAttribute("inert");
        else el.setAttribute("inert", value);
      }
      prevInertRef.current = null;
      const prev = prevFocusRef.current;
      if (prev && prev.isConnected && prev !== document.body && prev !== document.documentElement) {
        prev.focus({ preventScroll: true });
      }
      prevFocusRef.current = null;
    };
  }, [open, onClose, ref]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div aria-hidden onClick={onClose} className="scrim-anim absolute inset-0 bg-foreground/45" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={cn(
          "sheet-anim absolute overflow-y-auto bg-popover text-popover-foreground outline-none",
          // Mobile: bottom sheet, largura fixa da tela, rolagem interna.
          "inset-x-0 bottom-0 max-h-[82dvh] rounded-t-3xl border-t border-border shadow-sheet",
          // Desktop (≥640px): painel centralizado, largura consistente.
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:shadow-pop",
        )}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border sm:hidden" />
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 bg-popover px-5 pb-3 pt-3 sm:px-7 sm:pt-5">
          <div className="min-w-0 pt-1">
            {kicker ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {kicker}
              </p>
            ) : null}
            <h2 className="truncate font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-1">
            {headerExtra}
            <button
              type="button"
              aria-label="Fechar tradução"
              onClick={onClose}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
        <div className="px-5 pb-4 sm:px-7">{children}</div>
        {footer ? (
          <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-7 sm:pb-7">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
