import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { updateSettings, useAppState } from "@/lib/storage";

/* eslint-disable @typescript-eslint/no-explicit-any */

type RecognitionCtor = new () => any;

export type RecognitionError = "not-allowed" | "network" | "no-speech" | null;

/** Aviso exibido na 1ª vez que qualquer recurso abrir o reconhecimento (Fase 3). */
export const MIC_NOTICE_TEXT =
  "Seu áudio é processado pelo reconhecimento de voz do próprio navegador para virar texto — o app não grava nem envia nada.";

// Aviso global de microfone: qualquer instância do hook mostra/limpa o mesmo aviso.
let micNoticeState: string | null = null;
const micNoticeListeners = new Set<() => void>();
function setMicNotice(v: string | null) {
  micNoticeState = v;
  micNoticeListeners.forEach((l) => l());
}
export function useMicNotice(): string | null {
  return useSyncExternalStore(
    (cb) => {
      micNoticeListeners.add(cb);
      return () => micNoticeListeners.delete(cb);
    },
    () => micNoticeState,
    () => null,
  );
}
export function dismissMicNotice() {
  setMicNotice(null);
}

export function getRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface StartOptions {
  /** Chamado quando o usuário fica em silêncio por ≥ 3 s (ou 6 s iniciais). */
  onSilence?: () => void;
  /** Sotaque do reconhecimento (ex.: en-AU, en-US, en-GB). */
  lang?: string;
}

/** Gap entre trechos finais que conta como pausa longa. */
const PAUSE_GAP_MS = 2500;

export function useSpeechRecognition() {
  const { settings } = useAppState();
  // SSR e 1ª renderização do cliente concordam (false); o valor real entra após montar.
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(getRecognitionSupported());
  }, []);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<RecognitionError>(null);
  const recRef = useRef<any>(null);
  const transcriptRef = useRef<string[]>([]);
  const finalTimesRef = useRef<number[]>([]);
  const silenceTimer = useRef<number | null>(null);
  const onSilenceRef = useRef<(() => void) | null>(null);

  const clearSilence = useCallback(() => {
    if (silenceTimer.current !== null) {
      window.clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSilence();
    const rec = recRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* já parado */
      }
    }
    setListening(false);
  }, [clearSilence]);

  const start = useCallback(
    (opts?: StartOptions) => {
      if (!supported) return;
      // 1º uso do microfone no app: explica para que o áudio é usado (flag em
      // settings — não por questão). O aviso fica visível até ser fechado.
      if (!settings.micNoticeSeen) {
        setMicNotice(MIC_NOTICE_TEXT);
        updateSettings({ micNoticeSeen: true });
      }
      onSilenceRef.current = opts?.onSilence ?? null;
      transcriptRef.current = [];
      finalTimesRef.current = [];
      const w = window as any;
      const Ctor: RecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
      const rec = new Ctor();
      rec.lang = opts?.lang ?? settings.accent;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result?.isFinal) {
            const text = String(result[0]?.transcript ?? "").trim();
            if (text) {
              transcriptRef.current.push(text);
              finalTimesRef.current.push(Date.now());
            }
          }
        }
        clearSilence();
        silenceTimer.current = window.setTimeout(() => {
          stop();
          onSilenceRef.current?.();
        }, 3000);
      };
      rec.onerror = (event: any) => {
        const kind = String(event?.error ?? "");
        if (kind === "not-allowed" || kind === "service-not-allowed") setError("not-allowed");
        else if (kind === "network") setError("network");
        else if (kind === "no-speech") setError("no-speech");
      };
      rec.onend = () => {
        setListening(false);
        clearSilence();
      };
      recRef.current = rec;
      setError(null);
      try {
        rec.start();
        setListening(true);
        // silêncio inicial: se ninguém falar logo após abrir o microfone
        silenceTimer.current = window.setTimeout(() => {
          stop();
          onSilenceRef.current?.();
        }, 6000);
      } catch {
        setListening(false);
      }
    },
    [supported, stop, clearSilence, settings.accent, settings.micNoticeSeen],
  );

  const getTranscript = useCallback(
    () => transcriptRef.current.join(" ").replace(/\s+/g, " ").trim(),
    [],
  );

  /** Proxies de fluência: nº de pausas longas entre trechos reconhecidos. */
  const getStats = useCallback(() => {
    const times = finalTimesRef.current;
    let pauses = 0;
    for (let i = 1; i < times.length; i++) {
      if (times[i]! - times[i - 1]! > PAUSE_GAP_MS) pauses += 1;
    }
    return { pauses };
  }, []);

  useEffect(
    () => () => {
      if (silenceTimer.current !== null) window.clearTimeout(silenceTimer.current);
      try {
        recRef.current?.abort();
      } catch {
        /* ignora */
      }
    },
    [],
  );

  return {
    supported,
    listening,
    error,
    start,
    stop,
    getTranscript,
    getStats,
    clearError: () => setError(null),
  };
}
