import { useLastTtsVoice } from "@/lib/useSpeechSynthesis";

/**
 * Indica qual voz/sotaque do sistema foi realmente usada na reprodução de áudio
 * (projeto 9, Fase 9 — C6). Só aparece depois da primeira reprodução; o nome é
 * o da voz do próprio navegador, então varia por dispositivo.
 */
export function TtsVoiceNote() {
  const voice = useLastTtsVoice();
  if (!voice) return null;
  return (
    <p className="text-xs text-muted-foreground" role="status">
      Voz do sistema usada no áudio: <span className="text-foreground/80">{voice.name}</span> (
      {voice.lang})
    </p>
  );
}
