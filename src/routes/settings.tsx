import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  CalendarDays,
  Download,
  Mic,
  Palette,
  ShieldCheck,
  Sparkles,
  Timer,
  Volume2,
} from "lucide-react";

import { TopNav } from "@/components/TopNav";
import { PageHeader } from "@/components/layout/PageHeader";
import type { LucideIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  applyBackup,
  hasUndoBackup,
  previewBackup,
  undoBackup,
  type BackupPreview,
} from "@/lib/backup";
import {
  clearVocabAll,
  exportBackup,
  updateSettings,
  useAppState,
  usePersistFailed,
  useQuotaPressure,
  useStorageStatus,
  ACCENT_OPTIONS,
  DEFAULT_PLUS,
  type Accent,
  type PlusSettings,
} from "@/lib/storage";
import { PLUS_DISCLAIMER, PLUS_LABEL, PLUS_TOGGLES } from "@/lib/plus/settings";
import { vocabCounts } from "@/lib/plus/vocab";
import { loadAiStatus, mechanismLabel } from "@/lib/plus/aiStatus";
import { countdownLabel, daysUntil } from "@/lib/pte/goal";
import { cn } from "@/lib/utils";
import { downloadForOffline, useOfflineStatus } from "@/lib/offline";
import { THEME_OPTIONS, applyTheme, getThemeMode, setThemeMode, watchSystemTheme, type ThemeMode } from "@/lib/theme";

function OfflineSection() {
  const o = useOfflineStatus();
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <Download className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Uso offline</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Baixa todas as questões e páginas para treinar sem internet — inclusive tipos que você
            ainda não abriu.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          size="sm"
          className="min-h-11 sm:min-h-10"
          disabled={!o.supported || o.downloading}
          onClick={() => void downloadForOffline()}
        >
          {o.downloading ? `Baixando ${o.done}/${o.total}…` : "Baixar para offline"}
        </Button>
        {o.lastDownloadAt && !o.downloading && (
          <span className="break-words text-xs text-muted-foreground">
            Último download: {new Date(o.lastDownloadAt).toLocaleString("pt-BR")}
          </span>
        )}
      </div>
      {!o.supported && (
        <p className="mt-2 text-xs text-muted-foreground">
          Este navegador não suporta uso offline.
        </p>
      )}
      {o.error && <p className="mt-2 text-xs text-destructive">{o.error}</p>}
    </section>
  );
}

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes — PTE Master Hub" },
      {
        name: "description",
        content:
          "Prepare seu treino: tempo de preparação, meta diária, velocidade do modelo, sotaque e backup.",
      },
      { property: "og:title", content: "Ajustes — PTE Master Hub" },
      {
        property: "og:description",
        content:
          "Tempo de preparação, meta diária, sotaque do reconhecimento e backup do progresso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const prepOptions = [
  { value: 20, label: "20 s" },
  { value: 30, label: "30 s" },
  { value: 40, label: "40 s (padrão PTE)" },
  { value: 0, label: "Sem contagem" },
];

const goalOptions = [5, 10, 15, 20];
const rateOptions = [
  { value: 1, label: "1.0× (normal)" },
  { value: 0.8, label: "0.8× (mais lento)" },
];
const targetOptions = [
  { value: 50, label: "50 — universidades" },
  { value: 58, label: "58 — trabalho/vistos" },
  { value: 65, label: "65 — imigração AU/UK" },
  { value: 79, label: "79 — pontuação máxima" },
];

function OptionGroup<T extends number | string>({
  title,
  description,
  icon: Icon,
  flat = false,
  options,
  current,
  onSelect,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Variante sem superfície própria (para viver dentro de outro cartão sem card-dentro-de-card). */
  flat?: boolean;
  options: { value: T; label: string }[];
  current: T;
  onSelect: (value: T) => void;
}) {
  return (
    <section
      className={cn(flat ? "" : "rounded-2xl border border-border/60 bg-card p-5 shadow-card")}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={current === o.value}
            onClick={() => onSelect(o.value)}
            className={cn(
              "inline-flex min-h-11 max-w-full items-center whitespace-normal rounded-xl border px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              current === o.value
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Rótulo do mecanismo de tradução: só após a hidratação (evita mismatch de SSR). */
function useMechanismLabel(aiEnabled: boolean): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setLabel(mechanismLabel(aiEnabled, navigator.onLine, loadAiStatus()));
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const timer = setInterval(update, 5000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      clearInterval(timer);
    };
  }, [aiEnabled]);
  return label;
}

/** Seção do pack studie-plus: 5 toggles independentes (traduções/áudio desligados por padrão; IA e captura ligados). */
function PlusSection() {
  const app = useAppState();
  const s = app.settings;
  const plus = s.plus ?? { ...DEFAULT_PLUS };
  const counts = vocabCounts(app.vocabulary);
  const toggle = (key: keyof PlusSettings, value: boolean) =>
    updateSettings({ plus: { ...plus, [key]: value } });
  const mechanism = useMechanismLabel(plus.aiTranslation);

  return (
    <section className="rounded-2xl border border-primary/20 bg-card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <Sparkles className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{PLUS_LABEL} (extra de estudo)</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {PLUS_DISCLAIMER} Traduções e áudio desligados por padrão; IA e captura de vocabulário
            ligados — ajuste como preferir.
          </p>
        </div>
      </div>
      {mechanism ? (
        <p className="mt-3">
          <span className="text-xs text-muted-foreground">Mecanismo de tradução: </span>
          <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground">
            {mechanism}
          </span>
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        {PLUS_TOGGLES.map((t) => {
          const on = plus[t.key];
          return (
            <button
              key={t.key}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => toggle(t.key, !on)}
              className="flex min-h-11 w-full items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
                  on ? "bg-primary" : "bg-secondary",
                )}
              >
                <span
                  className={cn(
                    "h-5 w-5 rounded-full bg-background shadow transition-transform",
                    on && "translate-x-5",
                  )}
                />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">{t.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{t.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Seu vocabulário:{" "}
          <span className="font-medium text-foreground">
            {counts.words} {counts.words === 1 ? "palavra" : "palavras"} · {counts.phrases}{" "}
            {counts.phrases === 1 ? "frase" : "frases"}
          </span>
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={counts.total === 0}>
              Limpar vocabulário…
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar vocabulário?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso apaga as {counts.total} {counts.total === 1 ? "entrada" : "entradas"} do seu
                vocabulário — as {counts.words} {counts.words === 1 ? "palavra" : "palavras"} e as{" "}
                {counts.phrases} {counts.phrases === 1 ? "frase" : "frases"} que você traduziu, com
                o progresso de estudo delas. Tentativas, sessões e ajustes não são afetados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Manter</AlertDialogCancel>
              <AlertDialogAction onClick={() => clearVocabAll()}>Limpar tudo</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Tudo fica salvo em{" "}
        <Link to="/vocabulary" className="text-primary underline underline-offset-2">
          Vocabulário
        </Link>{" "}
        para estudar depois.
      </p>
    </section>
  );
}

function SettingsPage() {
  const app = useAppState();
  const s = app.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(() => hasUndoBackup());
  const [pending, setPending] = useState<{ text: string; preview: BackupPreview } | null>(null);
  const [semUndoMode, setSemUndoMode] = useState<"replace" | "merge" | null>(null);
  const storageStatus = useStorageStatus();
  const quotaPressure = useQuotaPressure();
  const persistFailed = usePersistFailed();

  const exportar = () => {
    try {
      const blob = new Blob([exportBackup()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pte-master-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      updateSettings({ lastBackupAt: Date.now() });
      setBackupMsg("Backup exportado — guarde o arquivo baixado.");
    } catch {
      setBackupMsg("Não foi possível exportar agora.");
    }
  };

  const importar = async (file: File) => {
    try {
      const text = await file.text();
      const result = previewBackup(text);
      if (!result.ok) {
        setBackupMsg(`Arquivo inválido: ${result.error}`);
        return;
      }
      setBackupMsg(null);
      setPending({ text, preview: result.preview });
    } catch {
      setBackupMsg("Não foi possível ler o arquivo.");
    }
  };

  // Projeto 13 (§0.2): import honesto — sem espaço para guardar o undo, a
  // operação destrutiva só segue com confirmação explícita; o sucesso só é
  // anunciado com a gravação confirmada, e a mensagem diz se há undo.
  const aplicar = (mode: "replace" | "merge", opts: { allowWithoutUndo?: boolean } = {}) => {
    if (!pending) return;
    const result = applyBackup(pending.text, mode, opts);
    if (!result.ok) {
      if (result.error === "sem-undo") {
        setSemUndoMode(mode);
        return;
      }
      setBackupMsg(`Arquivo inválido: ${result.error}`);
    } else {
      const undoNote = result.undoSaved
        ? " Você pode desfazer logo abaixo."
        : " Não havia espaço para guardar o estado anterior — NÃO é possível desfazer.";
      setBackupMsg(
        (mode === "merge"
          ? "Backup mesclado — nada do progresso atual foi perdido."
          : "Progresso substituído pelo backup.") + undoNote,
      );
      setPending(null);
      setSemUndoMode(null);
    }
    setCanUndo(hasUndoBackup());
  };

  const confirmarImport = (mode: "replace" | "merge") => aplicar(mode);

  const desfazer = () => {
    if (undoBackup()) {
      setBackupMsg("Importação desfeita — o progresso anterior foi restaurado.");
      setCanUndo(hasUndoBackup());
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-16 pt-8 sm:px-6">
        <PageHeader
          kicker="Seu espaço de estudo"
          title="Ajustes"
          subtitle="Personalize o treino e proteja seu progresso neste navegador."
        />

        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Seu treino
        </h2>
        <OptionGroup
          title="Preparação"
          icon={Timer}
          description="Tempo para ler o passage mentalmente antes de gravar (o PTE dá 40 s)."
          options={prepOptions}
          current={s.prepSeconds}
          onSelect={(v) => updateSettings({ prepSeconds: v })}
        />
        <OptionGroup
          title="Meta diária"
          icon={CalendarDays}
          description="Quantas questões diferentes você quer ler por dia."
          options={goalOptions.map((g) => ({ value: g, label: `${g} questões` }))}
          current={s.dailyGoal}
          onSelect={(v) => updateSettings({ dailyGoal: v })}
        />
        <OptionGroup
          title="Velocidade do modelo"
          icon={Volume2}
          description="Velocidade padrão ao ouvir o passage lido pela voz do navegador."
          options={rateOptions}
          current={s.modelRate}
          onSelect={(v) => updateSettings({ modelRate: v })}
        />
        <OptionGroup<Accent>
          title="Sotaque do reconhecimento"
          icon={Mic}
          description="Sotaque usado para transcrever sua leitura. O PTE usa inglês australiano."
          options={ACCENT_OPTIONS}
          current={s.accent}
          onSelect={(v) => updateSettings({ accent: v })}
        />

        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <ShieldCheck className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Prova</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Sua meta: data da prova e pontuação-alvo. O app usa isso para mostrar a contagem
                regressiva e medir sua prontidão — nada sai daqui do navegador.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="exam-date"
                className="mb-1.5 block text-sm font-medium text-foreground/90"
              >
                Data da prova
              </label>
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                <input
                  id="exam-date"
                  type="date"
                  value={s.examDate ?? ""}
                  onChange={(e) => updateSettings({ examDate: e.target.value || null })}
                  className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {s.examDate ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 sm:min-h-10"
                    onClick={() => updateSettings({ examDate: null })}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
              {s.examDate ? (
                <p className="mt-2 text-sm text-primary">{countdownLabel(daysUntil(s.examDate))}</p>
              ) : null}
            </div>
            <OptionGroup
              flat
              title="Pontuação-alvo"
              icon={Archive}
              description="Sua meta de score no PTE (escala 10–90). As estimativas de treino do app usam a mesma escala."
              options={targetOptions}
              current={s.targetScore}
              onSelect={(v) => updateSettings({ targetScore: v })}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <ShieldCheck className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Fontes das questões</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Quando ativado, as filas de treino (SRS, plano e simulado) usam só fontes
                verificadas. As listas continuam mostrando tudo, sempre com o selo da fonte.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant={s.verifiedOnly ? "default" : "outline"}
              size="sm"
              className="min-h-11 sm:min-h-10"
              onClick={() => updateSettings({ verifiedOnly: !s.verifiedOnly })}
            >
              {s.verifiedOnly ? "Só fontes verificadas" : "Todas as fontes"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Verificada = fonte pública com curadoria · Comunitária = contribuição de usuários · IA =
            predição gerada por IA (peso reduzido na prontidão).
          </p>
        </section>

        <OfflineSection />

        <PlusSection />

        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Seus dados
        </h2>

        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Archive className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Backup do progresso</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Seu histórico vive só neste navegador. Exporte um arquivo JSON para guardar ou levar
                para outro dispositivo — e importe de volta quando quiser.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="min-h-11 w-full whitespace-normal sm:w-auto"
              onClick={exportar}
            >
              Exportar backup
            </Button>
            <Button
              variant="outline"
              className="min-h-11 w-full whitespace-normal sm:w-auto"
              onClick={() => fileRef.current?.click()}
            >
              Importar backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importar(file);
                e.target.value = "";
              }}
            />
          </div>
          {backupMsg ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-3 flex items-start gap-2 rounded-xl border border-border/60 bg-secondary/50 p-3 text-sm text-foreground"
            >
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0 break-words">{backupMsg}</span>
            </p>
          ) : null}
          {canUndo && !backupMsg ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-foreground/85">
              Existe uma importação que pode ser desfeita.{" "}
              <Button variant="outline" size="sm" className="min-h-11" onClick={desfazer}>
                Desfazer importação
              </Button>
            </p>
          ) : null}
          {pending ? (
            <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground">Revisar importação</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Confira o que o arquivo traz antes de escolher como aplicar.
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Tentativas</dt>
                  <dd className="font-medium tabular-nums">{pending.preview.attempts}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Questões com progresso</dt>
                  <dd className="font-medium tabular-nums">{pending.preview.questions}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Sessões</dt>
                  <dd className="font-medium tabular-nums">{pending.preview.sessions}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Vocabulário</dt>
                  <dd className="font-medium tabular-nums">
                    {pending.preview.vocabWords} w · {pending.preview.vocabPhrases} f
                  </dd>
                </div>
              </dl>
              {pending.preview.version != null ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Versão do backup: {pending.preview.version}.
                </p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">
                <strong>Mesclar</strong> une os dois, mantendo o melhor resultado de cada questão.{" "}
                <strong>Substituir</strong> troca todo o progresso atual pelo do arquivo (você pode
                desfazer).
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  size="sm"
                  className="min-h-11 sm:min-h-10"
                  onClick={() => confirmarImport("merge")}
                >
                  Mesclar com o atual
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="min-h-11 sm:min-h-10"
                  onClick={() => confirmarImport("replace")}
                >
                  Substituir progresso
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-11 sm:min-h-10"
                  onClick={() => {
                    setPending(null);
                    setBackupMsg(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
          <AlertDialog
            open={semUndoMode !== null}
            onOpenChange={(o) => {
              if (!o) setSemUndoMode(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Importar sem como desfazer?</AlertDialogTitle>
                <AlertDialogDescription>
                  Não há espaço para guardar o estado anterior — se continuar, NÃO será possível
                  desfazer esta importação. Se quiser proteger o progresso atual, exporte um backup
                  antes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (semUndoMode) aplicar(semUndoMode, { allowWithoutUndo: true });
                  }}
                >
                  Importar mesmo assim
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {(() => {
            const days = s.lastBackupAt
              ? Math.floor((Date.now() - s.lastBackupAt) / 86_400_000)
              : null;
            if (days == null && app.attempts.length >= 20) {
              return (
                <p className="mt-3 text-sm text-muted-foreground">
                  Você já treinou {app.attempts.length} vezes e ainda não tem backup. Exporte um
                  arquivo para não arriscar perder o progresso.
                </p>
              );
            }
            if (days != null && days >= 14) {
              return (
                <p className="mt-3 text-sm text-muted-foreground">
                  Último backup: há {days} dia(s). Vale exportar um novo.
                </p>
              );
            }
            return null;
          })()}
        </section>

        {storageStatus !== "ok" ? (
          <div
            className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-5"
            role={storageStatus === "future" ? "alert" : undefined}
          >
            <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-foreground" />
            {storageStatus === "quarantined" ? (
              <p className="text-sm text-foreground">
                Encontramos dados salvos ilegíveis neste navegador e os guardamos em quarentena em
                vez de apagá-los — o app começou com o progresso limpo. Se você tinha um backup,
                importe-o aqui para recuperar.
              </p>
            ) : (
              <p className="text-sm text-foreground">
                Estes dados foram salvos por uma versão mais nova do app. Ainda dá para treinar e
                exportar um backup, mas nada será gravado até você atualizar o app.
              </p>
            )}
          </div>
        ) : null}
        {quotaPressure || persistFailed ? (
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">
              {persistFailed
                ? "O navegador negou o armazenamento persistente — em modo anônimo ou com pouco espaço, o progresso pode ser apagado ao limpar dados do site."
                : "O armazenamento deste navegador está chegando perto do limite."}{" "}
              Exporte um backup para garantir seu histórico.
            </p>
            <Button className="mt-3" variant="outline" size="sm" onClick={exportar}>
              Exportar agora
            </Button>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Tudo é salvo automaticamente neste navegador, sem conta. O reconhecimento de voz pode usar
          um serviço do próprio navegador (ex.: Chrome) — o app não envia nada por conta própria.
        </p>
      </main>
    </div>
  );
}
