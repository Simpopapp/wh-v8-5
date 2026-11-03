import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useAppState } from "@/lib/storage";

/** Escolhe a voz que melhor casa com o idioma (exato → mesmo prefixo, senão undefined). */
function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();
  const prefix = lang.toLowerCase().split("-")[0] ?? lang.toLowerCase();
  return (
    voices.find((v) => norm(v) === lang.toLowerCase()) ??
    voices.find((v) => norm(v).startsWith(prefix)) ??
    undefined
  );
}

// Fase 9 (C6): última voz TTS realmente usada na reprodução. Store global — o app
// cria várias instâncias do hook (motores, exame) e a UI mostra a voz em uso.
export interface TtsVoiceInfo {
  name: string;
  lang: string;
}
let ttsVoiceState: TtsVoiceInfo | null = null;
const ttsVoiceListeners = new Set<() => void>();
function setTtsVoice(v: TtsVoiceInfo | null) {
  if (ttsVoiceState?.name === v?.name && ttsVoiceState?.lang === v?.lang) return;
  ttsVoiceState = v;
  ttsVoiceListeners.forEach((l) => l());
}
/** Voz do sistema usada na última reprodução (null = nada reproduzido ainda). */
export function useLastTtsVoice(): TtsVoiceInfo | null {
  return useSyncExternalStore(
    (cb) => {
      ttsVoiceListeners.add(cb);
      return () => ttsVoiceListeners.delete(cb);
    },
    () => ttsVoiceState,
    () => null,
  );
}

/**
 * TTS do navegador. O sotaque vem dos Ajustes (en-AU por padrão) — todos os motores
 * herdam isso. No Chrome `getVoices()` pode vir vazio na primeira chamada; esperamos
 * o evento `voiceschanged` (com limite) antes de falar.
 */
export function useSpeechSynthesis() {
  const { settings } = useAppState();
  const lang = settings.accent;
  // SSR e a primeira renderização do cliente devem concordar (hidratação):
  // `supported` só vira true após montar, via effect.
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);
  const [speaking, setSpeaking] = useState(false);
  const token = useRef(0);

  const cancel = useCallback(() => {
    token.current += 1;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (
      text: string,
      rate = 1,
      langOverride?: string,
      // Fase 7 (SGD): tom por speaker (multi-voz) + callback de fim para encadear turnos.
      opts?: { pitch?: number; onend?: () => void },
    ) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const mine = ++token.current;
      setSpeaking(true);
      const targetLang = langOverride ?? lang;

      const run = () => {
        if (token.current !== mine) return; // outro speak/cancel chegou antes
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = targetLang;
        utterance.rate = rate;
        if (opts?.pitch !== undefined) utterance.pitch = Math.max(0, Math.min(2, opts.pitch));
        const voice = pickVoice(synth.getVoices(), targetLang);
        if (voice) {
          utterance.voice = voice;
          setTtsVoice({ name: voice.name, lang: voice.lang });
        } else {
          setTtsVoice({ name: "voz padrão do navegador", lang: targetLang });
        }
        utterance.onend = () => {
          if (token.current !== mine) return;
          setSpeaking(false);
          opts?.onend?.();
        };
        utterance.onerror = () => {
          if (token.current !== mine) return;
          setSpeaking(false);
          opts?.onend?.();
        };
        synth.speak(utterance);
      };

      if (synth.getVoices().length > 0) {
        run();
        return;
      }
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        synth.removeEventListener("voiceschanged", go);
        run();
      };
      synth.addEventListener("voiceschanged", go);
      window.setTimeout(go, 600); // sem vozes (ou evento nunca chega): fala com o padrão do navegador
    },
    [lang],
  );

  useEffect(() => cancel, [cancel]);

  return { supported, speaking, speak, cancel };
}
