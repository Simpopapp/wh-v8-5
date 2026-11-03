import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { TopNav } from "@/components/TopNav";
import { MicNotice } from "@/components/MicNotice";
import { TtsVoiceNote } from "@/components/TtsVoiceNote";
import { Button } from "@/components/ui/button";
import {
  TYPE_META,
  isDuplicateId,
  sourceClass,
  type QuestionMeta,
  type SourceClass,
  type UnifiedQuestion,
} from "@/lib/pte";
import { SessionSkip } from "@/components/practice/SessionSkip";
import {
  completeSessionItem,
  isSessionItem,
  sessionFinished,
  sessionNextId,
  useSession,
} from "@/lib/session";
import { computeStats, toggleBookmark, upsertNote, useAppState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { isModalOpen, shouldSkipShortcut } from "@/lib/shortcutGuard";
import { usePageFocusTarget } from "@/lib/pageFocus";

const NOTES_MAX = 2000;

/** Barra da sessão mista: detecta a tentativa da questão atual e oferece a próxima. */
function SessionBanner({ qid }: { qid: string }) {
  const session = useSession();
  const app = useAppState();
  const navigate = useNavigate();
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    mountedAt.current = Date.now();
  }, [qid]);

  useEffect(() => {
    if (!session.active || sessionNextId() !== qid) return;
    const last = app.attempts[app.attempts.length - 1];
    if (last && last.qid === qid && last.ts >= mountedAt.current) {
      completeSessionItem({ qid, score: last.score ?? null, wpm: last.wpm ?? null });
    }
  }, [app.attempts, qid, session.active]);

  if (!session.active || !isSessionItem(qid)) return null;
  const pct = (session.index / Math.max(session.size, 1)) * 100;
  const current = sessionNextId() === qid;
  const nid = sessionNextId();
  return (
    <div className="mb-4 rounded-2xl border border-border/60 bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          Sessão · {session.index} de {session.size}
        </span>
        {current ? (
          <SessionSkip qid={qid} />
        ) : sessionFinished() ? (
          <Button size="sm" onClick={() => navigate({ to: "/session", search: { done: true } })}>
            Ver resumo
          </Button>
        ) : nid ? (
          <Button size="sm" onClick={() => navigate({ to: "/practice", search: { q: nid } })}>
            Próxima da sessão →
          </Button>
        ) : null}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Overlay com a lista de atalhos de teclado (tecla ?). */
function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const items: [string, string][] = [
    ["← / K", "Questão anterior"],
    ["→ / J", "Próxima questão"],
    ["B", "Favoritar / desfavoritar"],
    ["N", "Abrir / fechar nota"],
    ["?", "Esta lista de atalhos"],
    ["Esc", "Fechar"],
  ];
  return (
    <div
      role="dialog"
      aria-label="Atalhos de teclado"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-lg font-semibold">Atalhos de teclado</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {items.map(([key, label]) => (
            <li key={key} className="flex items-center justify-between gap-4">
              <kbd className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs">
                {key}
              </kbd>
              <span className="text-muted-foreground">{label}</span>
            </li>
          ))}
        </ul>
        <Button size="sm" className="mt-5 w-full" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

interface PracticeShellProps {
  question: UnifiedQuestion;
  /** Pool navegável (todas as questões do mesmo task type). */
  pool: QuestionMeta[];
  children: ReactNode;
  /** Título curto da tarefa (h1). Default: label do task type. */
  title?: string;
  /** Instrução de execução exibida antes do estímulo (não cronômetro). */
  instruction?: ReactNode;
  /** Texto de status no canto esquerdo da barra inferior. */
  footerText?: ReactNode;
  /** Ações no canto direito da barra inferior. */
  footerActions?: ReactNode;
  /** Progresso de sessão próprio do motor (ex.: Read Aloud) — substitui o SessionBanner. */
  sessionProgress?: ReactNode;
  /** "preview": moldura de estudo (Soon) — sem footer, notas e avisos de execução. */
  mode?: "interactive" | "preview";
}

/** Moldura compartilhada dos motores de prática (header com navegação + barra inferior). */
export function PracticeShell({
  question,
  pool,
  children,
  title,
  instruction,
  footerText = null,
  footerActions = null,
  sessionProgress,
  mode = "interactive",
}: PracticeShellProps) {
  const app = useAppState();
  const navigate = useNavigate();
  const stats = useMemo(() => computeStats(app), [app]);
  // Alvo de foco pós-navegação/skip link (projeto 13, §0.3).
  const titleRef = usePageFocusTarget<HTMLHeadingElement>();

  // ---- Nota por questão (abre com N, salva com debounce de 400 ms) ----
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const notesRef = useRef(app.notes);
  notesRef.current = app.notes;

  // No SSR a hidratação começa com o snapshot vazio (getServerSnapshot); o efeito
  // de montagem rodaria com notas ausentes. Por isso o rascunho é recarregado
  // do estado atual sempre que a nota é aberta ou a questão muda.
  const loadDraft = useCallback(
    (qid: string) => setNoteDraft(notesRef.current[qid]?.text ?? ""),
    [],
  );

  useEffect(() => {
    loadDraft(question.id);
    setNotesOpen(false);
  }, [loadDraft, question.id]);

  const openNotes = (open: boolean) => {
    if (open) loadDraft(question.id);
    setNotesOpen(open);
  };

  useEffect(() => {
    if (noteDraft === (notesRef.current[question.id]?.text ?? "")) return;
    const t = window.setTimeout(() => {
      upsertNote(question.id, noteDraft);
    }, 400);
    return () => window.clearTimeout(t);
  }, [noteDraft, question.id]);

  const storedNote = app.notes[question.id]?.text ?? "";
  const noteSaved = noteDraft === storedNote;

  // ---- Agenda da questão ----
  const dueAt = stats.get(question.id)?.dueAt;
  const dueLabel = useMemo(() => {
    if (!dueAt) return null;
    const now = Date.now();
    if (dueAt <= now) return "Revisar hoje";
    const days = Math.ceil((dueAt - now) / 86_400_000);
    return `Revisão em ${days} ${days === 1 ? "dia" : "dias"}`;
  }, [dueAt, app.attempts.length]);

  const idx = Math.max(
    0,
    pool.findIndex((p) => p.id === question.id),
  );
  const number = idx + 1;
  const prevId = pool[(idx - 1 + pool.length) % pool.length]?.id;
  const nextId = pool[(idx + 1) % pool.length]?.id;
  const bookmarked = app.bookmarks.includes(question.id);

  // ---- Atalhos de teclado (ignorados enquanto digita) ----
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Projeto 13 (D10): com modal aberto, o Esc é do modal (o sheet trata).
        if (isModalOpen()) return;
        setShowHelp(false);
        // Fase 9 (a11y): Esc também fecha o painel de notas, mesmo com foco no textarea
        // (update funcional — o closure do listener não conhece o estado atual)
        setNotesOpen((v) => (v ? false : v));
        return;
      }
      // Projeto 13 (D10): atalhos globais não atravessam modais; campos
      // editáveis continuam protegidos pelo guard.
      if (shouldSkipShortcut(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowLeft":
        case "k":
        case "K":
          if (prevId) {
            e.preventDefault();
            navigate({ to: "/practice", search: { q: prevId } });
          }
          break;
        case "ArrowRight":
        case "j":
        case "J":
          if (nextId) {
            e.preventDefault();
            navigate({ to: "/practice", search: { q: nextId } });
          }
          break;
        case "b":
        case "B":
          toggleBookmark(question.id);
          break;
        case "n":
        case "N":
          setNotesOpen((v) => {
            if (!v) loadDraft(question.id);
            return !v;
          });
          break;
        case "?":
          setShowHelp((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevId, nextId, question.id, navigate]);

  const hasNote = storedNote.length > 0;
  const preview = mode === "preview";

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-44">
        {/* Cabeçalho da questão (identidade do tipo + posição) */}
        <div className="relative mb-5 overflow-hidden rounded-2xl border border-border/60 bg-card bg-glow p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {TYPE_META[question.taskType].label}
              </p>
              <h1
                ref={titleRef}
                id="page-title"
                tabIndex={-1}
                className="mt-1 font-serif text-2xl font-semibold tracking-tight text-foreground focus:outline-none"
              >
                {title ?? TYPE_META[question.taskType].label}
              </h1>
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                Questão {number} de {pool.length}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Atalhos de teclado"
                title="Atalhos (?)"
                className="min-h-11 min-w-[44px] text-muted-foreground"
                onClick={() => setShowHelp(true)}
              >
                ?
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Marcar como difícil"
                aria-pressed={bookmarked}
                className={cn(
                  "min-h-11 min-w-[44px] text-base",
                  bookmarked ? "text-primary" : "text-muted-foreground",
                )}
                onClick={() => toggleBookmark(question.id)}
              >
                ★
              </Button>
              {prevId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ to: "/practice", search: { q: prevId } })}
                >
                  ← Anterior
                </Button>
              ) : null}
              {nextId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ to: "/practice", search: { q: nextId } })}
                >
                  Próxima →
                </Button>
              ) : null}
            </div>
          </div>
          {/* Detalhes secundários (projeto 13, §4.4.1): primeiro nível = tipo,
              posição e navegação; tópico/fonte/palavras/revisão ficam no disclosure. */}
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="-mx-2 inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 font-medium transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Detalhes da questão
            </summary>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-0.5">{question.topic}</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5",
                  sourceClass(question.source) === "verificada"
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {
                  (
                    {
                      verificada: "verificada",
                      comunitária: "comunitária",
                      ia: "IA",
                    } satisfies Record<SourceClass, string>
                  )[sourceClass(question.source)]
                }
              </span>
              {isDuplicateId(question.id) ? (
                <span className="rounded-full bg-secondary px-2.5 py-0.5">repetida</span>
              ) : null}
              <span>{question.wordCount} palavras</span>
              {dueLabel ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5",
                    dueLabel === "Revisar hoje"
                      ? "bg-primary/10 font-medium text-primary"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {dueLabel}
                </span>
              ) : null}
            </div>
          </details>
        </div>

        {/* Nota da questão (oculta no modo preview) */}
        {!preview ? (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => openNotes(!notesOpen)}
              aria-expanded={notesOpen}
              aria-controls="questao-nota"
              className="inline-flex min-h-[44px] items-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {notesOpen ? "▾" : "▸"} Nota{hasNote ? " ✓" : ""}{" "}
              <span className="font-normal text-muted-foreground">(tecla N)</span>
            </button>
            {notesOpen ? (
              <div
                id="questao-nota"
                className="mt-2 rounded-2xl border border-border/60 bg-card p-4"
              >
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={4}
                  maxLength={NOTES_MAX}
                  placeholder="Anotação livre sobre esta questão (ex.: armadilha, palavra nova)…"
                  className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {noteDraft.length}/{NOTES_MAX}
                  </span>
                  <span className={cn(noteSaved && hasNote ? "text-success" : "")}>
                    {noteSaved ? (hasNote ? "✓ nota salva" : "") : "salvando…"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!preview && !sessionProgress && question.taskType !== "read_aloud" ? (
          <SessionBanner qid={question.id} />
        ) : null}
        {!preview && sessionProgress ? sessionProgress : null}
        {!preview && <MicNotice />}
        {!preview && <TtsVoiceNote />}
        {instruction ? (
          <div className="mb-4 rounded-xl border border-border/60 bg-secondary/40 p-4 text-sm leading-relaxed text-foreground/90">
            {instruction}
          </div>
        ) : null}
        {children}
      </main>

      {/* Barra de ação inferior (footer = landmark, requisito axe "region").
       * Sticky acima da TabBar mobile (56px + safe area); desktop encosta no rodapé. */}
      {!preview ? (
        <footer className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 mt-auto border-t border-border/70 bg-background/95 backdrop-blur md:bottom-0">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1 basis-40 text-sm text-muted-foreground">
              {footerText}
            </div>
            <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
              {footerActions}
            </div>
          </div>
        </footer>
      ) : null}

      {showHelp ? <ShortcutsOverlay onClose={() => setShowHelp(false)} /> : null}
    </div>
  );
}
