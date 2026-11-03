import { useEffect, useRef, useState } from "react";

import type { AiPhraseResult } from "@/lib/plus/aiSchemas";
import type { PhraseData } from "@/lib/plus/phrases";
import { lookupPhrase } from "@/lib/plus/phrases";
import { vocabPhraseKey } from "@/lib/plus/vocab";
import { saveVocabPhrase, useAppState } from "@/lib/storage";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { AiPhraseCard, AiPhraseSkeleton } from "@/components/plus/AiPhraseCard";
import { MechanismChip, type Mechanism } from "@/components/plus/MechanismChip";
import { TranslationSheet } from "@/components/plus/TranslationSheet";
import { aiCacheStore, contextCacheKey, phraseCacheKey } from "@/lib/plus/aiCache";
import {
  aiSessionId,
  aiUsable,
  enterCooldown,
  loadAiStatus,
  pauseForCredits,
  saveAiStatus,
} from "@/lib/plus/aiStatus";
import { translateAiPhrase } from "@/lib/plus/ai-translate.functions";
import { cn } from "@/lib/utils";

interface PlusPhraseCardProps {
  /** Task type da questão (define o arquivo phrases/{type}.json). */
  type: string;
  /** Id da questão. */
  qid: string;
  /** Frases já segmentadas pelo chamador (mesma segmentação do extractor). */
  sentences: string[];
  /** Tradução por frase (settings.plus.phraseTranslation). Falso → sem expansão. */
  enabled: boolean;
  /** Áudio de pronúncia (settings.plus.plusAudio) — independente da tradução. */
  audioEnabled?: boolean;
  /** Projeto 11: IA de tradução no momento do click (settings.plus.aiTranslation). */
  aiEnabled?: boolean;
  /** Contexto IA: enunciado/texto da questão (quando distinto das frases). */
  questionText?: string;
  /** Contexto IA: alternativas de MCQ (a tradução nunca revela a resposta). */
  options?: string[];
  /** Contexto IA: itens vizinhos (reorder — coesão e conectores). */
  neighbors?: string[];
}

/** Dedupe (D10): chamadas idênticas em voo compartilham a mesma Promise. */
const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof translateAiPhrase>>>>();

/**
 * Card do pack "studie-plus" com dois recursos independentes:
 * - Tradução por frase (tipo 2): cada frase abre (só por tap explícito) o
 *   TranslationSheet com a tradução — SÓ TEXTO. Tradução nunca tem áudio: o
 *   aluno já sabe falar português; o áudio ensina a pronúncia do inglês.
 *   Projeto 11: com IA ativa e internet no ar, a tradução é gerada no momento
 *   do click (modelo B — tradução completa + dicas de expressões); qualquer
 *   falha cai no mecanismo estático do pack, com chip honesto do mecanismo.
 *   Projeto 12: a expansão deixa de ser inline na lista e passa a usar o
 *   TranslationSheet (bottom sheet no mobile, painel central no desktop).
 *   Projeto 13 (D7/D8): o cache IA vem ANTES da checagem de disponibilidade —
 *   offline, em cooldown ou com créditos em pausa, a tradução já paga continua
 *   servível (chip honesto "Cache IA"); a chave inclui o contexto da chamada.
 * - Áudio de pronúncia: 🔊 compacto na linha da frase ORIGINAL em inglês,
 *   controlado só pelo toggle de áudio dos Ajustes (funciona com ou sem
 *   tradução; sem sotaque/idioma de tradução — herda settings.accent).
 */
export function PlusPhraseCard({
  type,
  qid,
  sentences,
  enabled,
  audioEnabled,
  aiEnabled,
  questionText,
  options,
  neighbors,
}: PlusPhraseCardProps) {
  const app = useAppState();
  const [data, setData] = useState<PhraseData | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const openRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [mechanism, setMechanism] = useState<Mechanism>("dictionary");
  const [aiView, setAiView] = useState<{
    phase: "loading" | "done";
    result: AiPhraseResult | null;
  } | null>(null);
  const [creditsNotice, setCreditsNotice] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const audio = audioEnabled === true;

  const loaded = data !== null;
  // Dados de tradução só carregam quando o recurso de tradução está ativo.
  useEffect(() => {
    if (!enabled) {
      setData(null);
      setOpen(null);
      return;
    }
    let active = true;
    const mods = import.meta.glob<{ default: PhraseData }>("@/data/plus/phrases/*.json");
    const loader = mods[`/src/data/plus/phrases/${type}.json`];
    const p = loader ? loader() : Promise.reject(new Error("sem dados"));
    p.then((mod) => {
      if (active) setData((mod.default ?? mod) as PhraseData);
    }).catch(() => {
      if (active) setData({});
    });
    return () => {
      active = false;
    };
  }, [enabled, type]);

  if (!enabled && !audio) return null;

  const entry = enabled && loaded ? (data ?? {})[qid] : undefined;
  const hasData = Boolean(entry && Array.isArray(entry.t) && entry.t.some((t) => t?.l?.trim()));
  // Modo tradução: dados do pack OU mecanismo IA (que dispensa dados pré-escritos).
  const translationMode = enabled && (hasData || aiEnabled === true);

  // Estado vazio honesto: sem tradução e sem áudio nada sobra para mostrar.
  // (Também cobre o primeiro render, antes dos dados carregarem — igual ao
  // comportamento anterior: nada pisca como "carregando".)
  if (enabled && !audio && !translationMode) {
    return (
      <div className="mt-4 rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
        <p className="font-serif text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tradução por frase · Studie Plus
        </p>
        <p className="mt-1 text-xs">Tradução de frase não disponível para esta questão.</p>
      </div>
    );
  }

  const header = translationMode
    ? "Tradução por frase · Studie Plus"
    : "Pronúncia por frase · Studie Plus";

  const setOpenBoth = (v: number | null) => {
    openRef.current = v;
    setOpen(v);
  };

  const captureStatic = (s: string, i: number) => {
    if (app.settings.plus.vocabCapture !== true) return;
    const t = lookupPhrase(data ?? {}, qid, i);
    if (t) {
      saveVocabPhrase({
        type,
        qid,
        index: i,
        en: s,
        literal: t.l,
        ...(t.c !== undefined ? { contextual: t.c } : {}),
        engine: "glossary",
        ts: Date.now(),
      });
    }
  };

  const captureAi = (s: string, i: number, result: AiPhraseResult) => {
    if (app.settings.plus.vocabCapture !== true) return;
    const firstTip = result.tips[0];
    saveVocabPhrase({
      type,
      qid,
      index: i,
      en: s,
      literal: result.translation,
      ...(firstTip ? { contextual: `${firstTip.term} — ${firstTip.note}`.slice(0, 200) } : {}),
      engine: "ai",
      ts: Date.now(),
    });
  };

  /** Chamada IA com dedupe; na volta, resolve ou cai no fallback (D5/D10). */
  const requestAi = (i: number, s: string, key: string) => {
    let req = inFlight.get(key);
    if (!req) {
      req = translateAiPhrase({
        data: {
          sentence: s,
          taskType: type,
          ...(questionText !== undefined ? { questionText } : {}),
          ...(options !== undefined ? { options } : {}),
          ...(neighbors !== undefined ? { neighbors } : {}),
          sessionId: aiSessionId(),
        },
      }).finally(() => {
        inFlight.delete(key);
      });
      inFlight.set(key, req);
    }
    void req
      .then((resp) => {
        if (openRef.current !== i) return; // expansão já fechada — resposta órfã
        if (resp && resp.ok) {
          aiCacheStore.putPhrase(key, resp.result);
          setAiView({ phase: "done", result: resp.result });
          captureAi(s, i, resp.result);
          return;
        }
        const code = resp && !resp.ok ? resp.code : "invalid";
        const status = loadAiStatus();
        if (code === "credits") {
          saveAiStatus(pauseForCredits(status));
          setCreditsNotice(true);
        } else if (code === "rate" || code === "network") {
          saveAiStatus(enterCooldown(status));
        }
        setAiView(null);
        setMechanism(code === "invalid" ? "dictionary" : "dictionary-offline");
        captureStatic(s, i);
      })
      .catch(() => {
        // falha de rede (fetch rejeita) → mesma rota do fallback transitório
        if (openRef.current !== i) return;
        saveAiStatus(enterCooldown(loadAiStatus()));
        setAiView(null);
        setMechanism("dictionary-offline");
        captureStatic(s, i);
      });
  };

  const expand = (i: number) => {
    if (open === i) {
      setOpenBoth(null);
      return;
    }
    const s = sentences[i] ?? "";
    const attemptAi =
      enabled === true && aiEnabled === true && aiUsable(true, online, loadAiStatus());
    setOpenBoth(i);
    setAiView(null);
    // Projeto 13 (D7/D8): cache ANTES da checagem de disponibilidade, e a
    // chave inclui o contexto — enunciado/opções diferentes = tradução nova.
    const key = phraseCacheKey(type, s, contextCacheKey(questionText, options, neighbors));
    if (aiEnabled === true) {
      const hit = aiCacheStore.getPhrase(key);
      if (hit) {
        setMechanism("ai-cache");
        setAiView({ phase: "done", result: hit });
        captureAi(s, i, hit);
        return;
      }
    }
    if (attemptAi) {
      setMechanism("ai");
      setAiView({ phase: "loading", result: null });
      requestAi(i, s, key);
    } else {
      setMechanism(aiEnabled === true ? "dictionary-offline" : "dictionary");
      captureStatic(s, i);
    }
  };

  const closeSheet = () => {
    setOpenBoth(null);
  };

  const CaptureFooter = ({ i }: { i: number }) => {
    const saved = app.vocabulary.phrases[vocabPhraseKey(type, qid, i)];
    if (!saved) return null;
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-medium text-success"
        aria-live="polite"
      >
        ✓ Salvo no vocabulário
        {saved.seenCount > 1 ? ` · ${saved.seenCount}×` : ""}
      </span>
    );
  };

  const sheetOpen = translationMode && open !== null;
  const sheetSentence = sheetOpen ? (sentences[open] ?? "") : "";
  const sheetIndex = sheetOpen ? open : 0;

  const sheetBody = (() => {
    if (!sheetOpen) return null;
    if (aiView?.phase === "loading") return <AiPhraseSkeleton />;
    if (aiView?.phase === "done" && aiView.result) return <AiPhraseCard result={aiView.result} />;
    const t = lookupPhrase(data ?? {}, qid, sheetIndex);
    return (
      <>
        {t ? (
          <>
            <p className="text-[15px] font-medium leading-relaxed text-foreground">{t.l}</p>
            {t.c ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.c}</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Tradução não disponível para esta frase.</p>
        )}
        {creditsNotice ? (
          <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-snug text-warning-foreground">
            Créditos de IA esgotados — o dicionário do pack continua disponível.
          </p>
        ) : null}
      </>
    );
  })();

  return (
    <>
      <div className="mt-4 rounded-2xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <p className="font-serif text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {header}
          </p>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Toque numa frase
          </span>
        </div>
        <ul className="mt-2 space-y-1">
          {sentences.map((s, i) => {
            const isOpen = open === i;
            return (
              <li key={`${qid}-${i}`}>
                <div className="flex items-start gap-1">
                  {translationMode ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => expand(i)}
                      className={cn(
                        "flex min-h-[44px] min-w-0 flex-1 items-start justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                        isOpen ? "bg-secondary" : "hover:bg-secondary",
                      )}
                    >
                      <span className="min-w-0 flex-1 font-serif leading-relaxed text-foreground/90">
                        {s}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 shrink-0 text-xs text-muted-foreground transition-transform",
                          isOpen && "rotate-180",
                        )}
                      >
                        ▾
                      </span>
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1 px-2 py-2 font-serif text-sm leading-relaxed text-foreground/90">
                      {s}
                    </span>
                  )}
                  {audio ? (
                    <PlusSpeakButton
                      text={s}
                      enabled
                      label={`Ouvir pronúncia da frase ${i + 1}`}
                      compact
                      className="mt-0.5"
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <TranslationSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Frase"
        kicker="Studie Plus · Tradução por frase"
        ariaLabel="Tradução da frase"
        panelRef={sheetRef}
        headerExtra={<MechanismChip mechanism={mechanism} />}
        footer={<CaptureFooter i={sheetIndex} />}
      >
        <p className="mb-3 border-l-2 border-primary/30 pl-3 font-serif text-sm italic leading-relaxed text-foreground/80">
          {sheetSentence}
        </p>
        {sheetBody}
      </TranslationSheet>
    </>
  );
}
