import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionIcon } from "@/components/layout/SectionIdentity";
import { QuestionRow } from "@/components/QuestionRow";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import {
  SECTION_META,
  TYPE_META,
  firstIdOfType,
  isSmallBank,
  loadQuestions,
  metaBySection,
} from "@/lib/pte";
import type { Section, TaskType } from "@/lib/pte/types";
import { computeStats, computeTypeStats, toggleBookmark, useAppState } from "@/lib/storage";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "untried" | "due" | "weak" | "starred";

/**
 * Task types cujo texto NÃO é a resposta (texto para ler / passagem de leitura): só estes mostram
 * pré-visualização na lista. Nos demais (ditado, repetição, listening…) o texto entregaria a resposta.
 */
const PREVIEW_TYPES: TaskType[] = ["read_aloud", "swt", "mcq_single", "mcq_multi"];

/** Carrega (sob demanda) os textos de pré-visualização dos task types seguros da seção. */
function usePreviewTexts(section: Section): Map<string, string> {
  const [texts, setTexts] = useState<Map<string, string>>(() => new Map());
  useEffect(() => {
    let alive = true;
    const types = PREVIEW_TYPES.filter((t) => TYPE_META[t].section === section);
    if (types.length === 0) return;
    loadQuestions(types)
      .then((list) => {
        if (alive) setTexts(new Map(list.map((q) => [q.id, q.text])));
      })
      .catch(() => {
        /* sem pré-visualização: a lista continua usável só com o manifesto */
      });
    return () => {
      alive = false;
    };
  }, [section]);
  return texts;
}

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "untried", label: "Não tentadas" },
  { value: "due", label: "Revisar hoje" },
  { value: "weak", label: "Precisam de treino" },
  { value: "starred", label: "★ Difíceis" },
];

const PAGE_SIZE = 50;

export function SectionPage({ section }: { section: Section }) {
  const app = useAppState();
  const stats = useMemo(() => computeStats(app), [app]);
  const typeStats = useMemo(() => computeTypeStats(app), [app]);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<TaskType | "">("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const meta = SECTION_META[section];
  const sectionTypes = (Object.keys(TYPE_META) as TaskType[]).filter(
    (t) => TYPE_META[t].section === section,
  );
  const pool = useMemo(() => metaBySection(section), [section]);
  const previews = usePreviewTexts(section);
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return pool.filter((q) => {
      if (type && q.taskType !== type) return false;
      if (needle) {
        const hay = `${q.topic} ${TYPE_META[q.taskType].label} ${previews.get(q.id) ?? ""}`;
        if (!hay.toLowerCase().includes(needle)) return false;
      }
      if (status === "untried") return !stats.has(q.id);
      if (status === "due") {
        const s = stats.get(q.id);
        return !!s && s.dueAt <= now;
      }
      if (status === "starred") return app.bookmarks.includes(q.id);
      if (status === "weak") {
        const s = stats.get(q.id);
        return !s || (s.bestContent ?? 0) < 90;
      }
      return true;
    });
  }, [pool, type, search, status, stats, app.bookmarks, previews, now]);

  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  // Contagem por filtro (chip numérico no seletor de status).
  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: pool.length,
      untried: 0,
      due: 0,
      weak: 0,
      starred: 0,
    };
    for (const q of pool) {
      const s = stats.get(q.id);
      if (!s) c.untried += 1;
      else if (s.dueAt <= now) c.due += 1;
      if (!s || (s.bestContent ?? 0) < 90) c.weak += 1;
      if (app.bookmarks.includes(q.id)) c.starred += 1;
    }
    return c;
  }, [pool, stats, app.bookmarks, now]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-4xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
        {/* Cabeçalho da seção */}
        <section className="pt-2 sm:pt-4">
          <div className="flex items-start gap-4">
            <SectionIcon section={section} />
            <PageHeader
              kicker={meta.label}
              title={meta.description}
              subtitle="Questões reais com correção na hora, revisão espaçada e progresso salvo — escolha um tipo e comece."
              className="min-w-0"
            />
          </div>

          {/* Cards por task type */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {sectionTypes.map((t) => {
              const ts = typeStats.get(t);
              const count = pool.filter((q) => q.taskType === t).length;
              const pct = count > 0 ? Math.round(((ts?.attemptedIds ?? 0) / count) * 100) : 0;
              const ready = TYPE_META[t].ready;
              const card = (
                <div
                  className={cn(
                    "h-full min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-colors",
                    ready && "hover:border-primary/50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <SectionIcon section={TYPE_META[t].section} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-lg font-semibold">{TYPE_META[t].label}</h2>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            ready
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {ready ? "praticar" : "em breve"}
                        </span>
                        {isSmallBank(t) ? (
                          <span
                            title="Banco pequeno — treine, mas não confie na cobertura"
                            className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                          >
                            banco pequeno
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                        {count} questões{ts ? ` · melhor ${ts.bestScore}%` : ""}
                      </p>
                    </div>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Progresso de ${TYPE_META[t].label}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
                  >
                    <div
                      className="h-full rounded-full bg-primary/70 transition-[width] duration-200"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                    {pct}% das questões tentadas
                  </p>
                </div>
              );
              const firstId = firstIdOfType(t);
              return ready && firstId ? (
                <Link key={t} to="/practice" search={{ q: firstId }} className="block">
                  {card}
                </Link>
              ) : (
                <div key={t}>{card}</div>
              );
            })}
          </div>
        </section>

        {/* Lista filtrável */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
          <h2 className="sr-only">Banco de questões</h2>
          <div className="space-y-3 border-b border-border/60 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Buscar</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setLimit(PAGE_SIZE);
                  }}
                  placeholder="Por tópico ou tipo…"
                  className="min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Tipo</span>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as TaskType | "");
                    setLimit(PAGE_SIZE);
                  }}
                  aria-label="Filtrar por tipo"
                  className={cn(
                    "min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                    type && "border-primary bg-primary/5",
                  )}
                >
                  <option value="">Todos os tipos</option>
                  {sectionTypes.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_META[t].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as StatusFilter);
                    setLimit(PAGE_SIZE);
                  }}
                  aria-label="Filtrar por status"
                  className={cn(
                    "min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                    status !== "all" && "border-primary bg-primary/5",
                  )}
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({statusCounts[o.value]})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {visible.length} de {filtered.length} questão(ões) exibidas
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="p-6 sm:p-8">
              <EmptyState
                icon={SearchX}
                title="Nenhuma questão encontrada"
                description="Tente limpar os filtros ou buscar por outro tópico."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setType("");
                      setStatus("all");
                      setLimit(PAGE_SIZE);
                    }}
                  >
                    Limpar filtros
                  </Button>
                }
              />
            </div>
          ) : (
            <div>
              {visible.map((q, i) => (
                <QuestionRow
                  key={q.id}
                  meta={q}
                  number={i + 1}
                  preview={previews.get(q.id)}
                  stat={stats.get(q.id)}
                  bookmarked={app.bookmarks.includes(q.id)}
                  onToggleBookmark={toggleBookmark}
                  now={now}
                />
              ))}
              {filtered.length > visible.length && (
                <div className="border-t border-border/60 p-4 text-center">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  >
                    Mostrar mais ({filtered.length - visible.length} restantes)
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
