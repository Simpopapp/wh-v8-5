import { useEffect, useMemo, useRef, useState } from "react";

import type { AiWordResult } from "@/lib/plus/aiSchemas";
import type { Glossary } from "@/lib/plus/glossary";
import { lookupWord } from "@/lib/plus/glossary";
import { splitWords } from "@/lib/plus/words";
import { splitSentences } from "@/lib/plus/sentences";
import { vocabWordKey } from "@/lib/plus/vocab";
import { saveVocabWord, useAppState } from "@/lib/storage";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { AiWordCard, AiWordSkeleton } from "@/components/plus/AiWordCard";
import { MechanismChip, type Mechanism } from "@/components/plus/MechanismChip";
import { TranslationSheet } from "@/components/plus/TranslationSheet";
import { aiCacheStore, wordCacheKey } from "@/lib/plus/aiCache";
import {
  aiSessionId,
  aiUsable,
  enterCooldown,
  loadAiStatus,
  pauseForCredits,
  saveAiStatus,
} from "@/lib/plus/aiStatus";
import { translateAiWord } from "@/lib/plus/ai-translate.functions";
import { cn } from "@/lib/utils";

interface PlusWordTextProps {
  text: string;
  /** Tradução por palavra (settings.plus.wordTranslation). Falso → sem tradução. */
  enabled: boolean;
  /** Áudio de pronúncia (settings.plus.plusAudio) — independente da tradução:
   *  palavras ficam tappable e o balão oferta 🔊 falando a palavra em inglês. */
  audioEnabled?: boolean;
  /** Classes do parágrafo (o motor decide o tamanho/tipografia). */
  className?: string;
  /** Renderiza <span> em vez de <p> (para trechos dentro de outro bloco). */
  inline?: boolean;
  /** Projeto 10: questão de origem do gesto — alimenta o vocabulário na captura. */
  source?: { type: string; qid: string };
  /** Projeto 11: IA de tradução no momento do click (settings.plus.aiTranslation). */
  aiEnabled?: boolean;
  /** Contexto IA: frase que contém o token (default: derivada do próprio texto). */
  sentence?: string;
  /** Contexto IA: enunciado/pergunta da questão (quando distinto do texto). */
  questionText?: string;
}

/** Dedupe (D10): chamadas idênticas em voo compartilham a mesma Promise. */
const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof translateAiWord>>>>();

/** Frase do token: recorte de contexto que carrega o sentido (cache + IA). */
function sentenceFor(text: string, core: string): string {
  if (!core) return text;
  const lower = core.toLowerCase();
  const hit = splitSentences(text).find((s) => s.toLowerCase().includes(lower));
  return hit ?? text;
}

/**
 * Parágrafo do pack "studie-plus": cada palavra é alvo de toque que abre o
 * TranslationSheet com a pronúncia (🔊 fala a palavra em INGLÊS, sotaque dos
 * Ajustes) e, quando a tradução por palavra está ativa, a tradução. Projeto
 * 11: com IA ativa e internet no ar, a tradução é gerada no momento do click
 * (modelo A — literal, na frase e por que não o sinônimo comum); qualquer
 * falha cai no mecanismo estático do pack, com chip honesto do mecanismo.
 * Projeto 12: o card é sempre o TranslationSheet — bottom sheet no mobile,
 * painel central no desktop (nunca mais ancorado ao ponto de clique).
 * Abre SOMENTE por tap explícito (nunca em hover/scroll); fecha por toque
 * fora, ✕ ou Esc, devolvendo o foco ao token de origem.
 * Projeto 13 (D7/D8): o cache IA vem ANTES da checagem de disponibilidade —
 * offline, em cooldown ou com créditos em pausa, a tradução já paga continua
 * servível (chip honesto "Cache IA"); o cache vive num store central.
 */
export function PlusWordText({
  text,
  enabled,
  audioEnabled,
  className,
  inline,
  source,
  aiEnabled,
  sentence,
  questionText,
}: PlusWordTextProps) {
  const app = useAppState();
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const openRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const spanRefs = useRef<(HTMLElement | null)[]>([]);

  // Projeto 11: mecanismo do card aberto (chip sempre reflete o conteúdo).
  const [mechanism, setMechanism] = useState<Mechanism>("dictionary");
  const [aiView, setAiView] = useState<{
    phase: "loading" | "done";
    result: AiWordResult | null;
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

  // Glossário carregado por import dinâmico, só quando o recurso está ativo.
  useEffect(() => {
    let active = true;
    if (enabled) {
      import("@/data/plus/glossary.json")
        .then((mod) => {
          if (active) setGlossary((mod.default ?? mod) as Glossary);
        })
        .catch(() => {
          if (active) setGlossary({});
        });
    } else {
      setGlossary(null);
      setOpen(null);
    }
    return () => {
      active = false;
    };
  }, [enabled]);

  const parts = useMemo(() => splitWords(text), [text]);
  const audio = audioEnabled === true;
  const interactive = (enabled && glossary !== null) || audio;

  // Captura (projeto 10): tradução EXIBIDA registra o gesto no vocabulário —
  // sinal deliberado (só abre por tap), nada é inventado em miss.
  const captureOn =
    enabled === true && source !== undefined && app.settings.plus.vocabCapture === true;

  const captureStaticWord = (core: string) => {
    if (!captureOn) return;
    const e = lookupWord(glossary ?? {}, core);
    if (e && source) {
      saveVocabWord({
        word: core,
        literal: e.literal,
        ...(e.contextual !== undefined ? { contextual: e.contextual } : {}),
        engine: "glossary",
        source,
        ts: Date.now(),
      });
    }
  };

  const captureAiWord = (core: string, result: AiWordResult) => {
    if (!captureOn) return;
    saveVocabWord({
      word: core,
      literal: result.literal,
      contextual: result.inSentence.translation,
      engine: "ai",
      source,
      ts: Date.now(),
    });
  };

  const setOpenBoth = (v: number | null) => {
    openRef.current = v;
    setOpen(v);
  };

  /** Fecha o sheet e devolve o foco ao token de origem. */
  const closeSheet = () => {
    const i = openRef.current;
    setOpenBoth(null);
    if (i !== null) {
      const el = spanRefs.current[i];
      el?.focus({ preventScroll: true });
    }
  };

  /** Chamada IA com dedupe; na volta, resolve ou cai no fallback (D5/D10). */
  const requestAi = (i: number, core: string, sent: string, key: string) => {
    let req = inFlight.get(key);
    if (!req) {
      req = translateAiWord({
        data: {
          word: core,
          sentence: sent,
          ...(questionText !== undefined ? { questionText } : {}),
          taskType: source?.type ?? "read_aloud",
          sessionId: aiSessionId(),
        },
      }).finally(() => {
        inFlight.delete(key);
      });
      inFlight.set(key, req);
    }
    void req
      .then((resp) => {
        if (openRef.current !== i) return; // card já fechado — resposta órfã
        if (resp && resp.ok) {
          aiCacheStore.putWord(key, resp.result);
          setAiView({ phase: "done", result: resp.result });
          captureAiWord(core, resp.result);
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
        captureStaticWord(core);
      })
      .catch(() => {
        // falha de rede (fetch rejeita) → mesma rota do fallback transitório
        if (openRef.current !== i) return;
        saveAiStatus(enterCooldown(loadAiStatus()));
        setAiView(null);
        setMechanism("dictionary-offline");
        captureStaticWord(core);
      });
  };

  const openAt = (i: number) => {
    if (open === i) {
      closeSheet();
      return;
    }
    const core = parts.tokens[i]?.core ?? "";
    const sent = sentence ?? sentenceFor(text, core);
    const attemptAi =
      enabled === true && aiEnabled === true && aiUsable(true, online, loadAiStatus());

    setOpenBoth(i);

    const key = wordCacheKey(core, sent);
    // Projeto 13 (D7): o cache vem ANTES da checagem de disponibilidade —
    // offline, em cooldown ou com créditos em pausa, a tradução já paga
    // continua servível, com chip honesto "Cache IA".
    if (aiEnabled === true) {
      const hit = aiCacheStore.getWord(key);
      if (hit) {
        setMechanism("ai-cache");
        setAiView({ phase: "done", result: hit });
        captureAiWord(core, hit);
        return;
      }
    }
    if (attemptAi) {
      setMechanism("ai");
      setAiView({ phase: "loading", result: null });
      requestAi(i, core, sent, key);
    } else {
      setAiView(null);
      setMechanism(aiEnabled === true ? "dictionary-offline" : "dictionary");
      captureStaticWord(core);
    }
  };

  const toggleAt = (i: number) => {
    openAt(i);
  };

  // Fecha por toque fora (fora do sheet e fora do texto).
  useEffect(() => {
    if (open === null) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (sheetRef.current?.contains(target)) return;
      const insideText = rootRef.current?.contains(target) ?? false;
      if (insideText) return;
      setOpenBoth(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (!interactive) {
    return inline ? (
      <span
        ref={(el) => {
          rootRef.current = el;
        }}
        className={className}
      >
        {text}
      </span>
    ) : (
      <p
        ref={(el) => {
          rootRef.current = el;
        }}
        className={className}
      >
        {text}
      </p>
    );
  }

  const entry = open !== null ? lookupWord(glossary ?? {}, parts.tokens[open]?.core ?? "") : null;

  const tokens = parts.tokens.map((t, i) => (
    <span
      key={`${t.core}-${i}`}
      ref={(el) => {
        spanRefs.current[i] = el;
      }}
      role="button"
      tabIndex={0}
      aria-label={
        enabled && audio
          ? `Traduzir e ouvir ${t.core}`
          : audio
            ? `Ouvir pronúncia de ${t.core}`
            : `Traduzir ${t.core}`
      }
      onClick={() => toggleAt(i)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleAt(i);
        }
      }}
      className={cn(
        "relative inline-block cursor-pointer whitespace-pre rounded-sm px-0.5 after:absolute after:-inset-x-0.5 after:-inset-y-2 after:content-['']",
        open === i ? "bg-secondary" : "hover:bg-secondary",
      )}
    >
      {t.core + t.trail}
    </span>
  ));

  const body = (
    <>
      {parts.lead ? parts.lead : null}
      {tokens}
    </>
  );

  const captureFooter = (() => {
    if (!source || open === null) return null;
    const saved = app.vocabulary.words[vocabWordKey(parts.tokens[open]?.core ?? "")];
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
  })();

  const speakBlock = audio ? (
    <div className="mb-3">
      <PlusSpeakButton
        text={parts.tokens[open ?? 0]?.core ?? ""}
        enabled
        label="Ouvir pronúncia da palavra"
        compact
      />
    </div>
  ) : null;

  const sheetBody = (() => {
    if (enabled) {
      if (aiView?.phase === "loading") return <AiWordSkeleton />;
      if (aiView?.phase === "done" && aiView.result) return <AiWordCard result={aiView.result} />;
      return (
        <>
          {entry ? (
            <>
              <p className="text-[15px] font-medium leading-relaxed text-foreground">
                {entry.literal}
              </p>
              {entry.contextual ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {entry.contextual}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tradução não disponível para esta palavra.
            </p>
          )}
          {creditsNotice ? (
            <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-snug text-warning-foreground">
              Créditos de IA esgotados — o dicionário do pack continua disponível.
            </p>
          ) : null}
        </>
      );
    }
    if (audio) {
      return <p className="text-xs text-muted-foreground">Pronúncia · Studie Plus</p>;
    }
    return null;
  })();

  return (
    <>
      {inline ? (
        <span
          ref={(el) => {
            rootRef.current = el;
          }}
          className={className}
        >
          {body}
        </span>
      ) : (
        <p
          ref={(el) => {
            rootRef.current = el;
          }}
          className={className}
        >
          {body}
        </p>
      )}

      <TranslationSheet
        open={open !== null}
        onClose={closeSheet}
        title={parts.tokens[open ?? 0]?.core ?? ""}
        kicker="Studie Plus"
        ariaLabel={enabled ? "Tradução da palavra" : "Pronúncia da palavra"}
        panelRef={sheetRef}
        headerExtra={enabled ? <MechanismChip mechanism={mechanism} /> : null}
        footer={captureFooter}
      >
        {speakBlock}
        {sheetBody}
      </TranslationSheet>
    </>
  );
}
