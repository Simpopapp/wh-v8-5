import { useEffect } from "react";

import { useAppState } from "@/lib/storage";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { cn } from "@/lib/utils";

interface PlusSpeakButtonProps {
  /** Texto a ser falado. */
  text: string;
  /** Pack ativo (settings.plus.plusAudio) — falso → nada renderiza. */
  enabled: boolean;
  /** Idioma de fala. Padrão: herda o sotaque dos Ajustes via useSpeechSynthesis.
   *  REGRA DO PACK: nunca passar um idioma de tradução (ex.: "pt-BR") — o pack
   *  fala SEMPRE o texto original em inglês, nunca o texto traduzido. */
  lang?: string;
  /** Rótulo acessível. */
  label?: string;
  /** Variante compacta: botão redondo só-ícone (para linhas de frase/palavra). */
  compact?: boolean;
  className?: string;
}

/**
 * Botão de áudio do pack "studie-plus": fala um texto que NÃO tem áudio nativo.
 * Reusa useSpeechSynthesis (Web Speech API), com rate herdado de modelRate e
 * sotaque dos Ajustes. Fala sempre o texto ORIGINAL em inglês — nunca uma
 * tradução. Cancela a fala ao trocar de questão (texto muda) e ao desmontar.
 */
export function PlusSpeakButton({
  text,
  enabled,
  lang,
  label,
  compact,
  className,
}: PlusSpeakButtonProps) {
  const { supported, speaking, speak, cancel } = useSpeechSynthesis();
  const { settings } = useAppState();
  const modelRate = settings.modelRate;

  // Cancela quando o texto muda (troca de questão) ou desmonta.
  useEffect(() => {
    return () => cancel();
  }, [text, cancel]);

  if (!enabled || !supported || !text.trim()) return null;

  const onClick = () => (speaking ? cancel() : speak(text, modelRate, lang));

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label ?? (speaking ? "Parar áudio" : "Ouvir pronúncia")}
        aria-pressed={speaking}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50",
          speaking && "bg-secondary text-foreground",
          className,
        )}
      >
        <span aria-hidden>{speaking ? "⏹" : "🔊"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? (speaking ? "Parar áudio" : "Ouvir pronúncia")}
      aria-pressed={speaking}
      className={cn(
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50",
        speaking && "bg-secondary text-foreground",
        className,
      )}
    >
      <span aria-hidden>{speaking ? "⏹" : "🔊"}</span>
      <span>{speaking ? "falando…" : (label ?? "ouvir")}</span>
    </button>
  );
}
