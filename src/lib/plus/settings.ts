import type { PlusSettings, Settings } from "@/lib/storage";

/**
 * true quando qualquer recurso do pack "studie-plus" está ativo — usado para
 * atalhar o carregamento dos dados do pack (import dinâmico só quando precisamos).
 */
export function plusEnabled(settings: Settings): boolean {
  const p = settings.plus;
  return p.wordTranslation || p.phraseTranslation || p.plusAudio;
}

/** Rótulo do pack usado na UI de Ajustes e nos recursos do pack. */
export const PLUS_LABEL = "Studie Plus";

/** Texto fixo de descorrelação (exigência do planejamento: extra de estudo, não PTE). */
export const PLUS_DISCLAIMER =
  "Studie Plus é um recurso extra para estudo — não faz parte da replicação do PTE. " +
  "Traduções e áudios extras não entram no seu score nem no histórico de treino.";

export type PlusToggle = keyof PlusSettings;

/** Todos os toggles do pack, na ordem de exibição em Ajustes. */
export const PLUS_TOGGLES: { key: PlusToggle; label: string; description: string }[] = [
  {
    key: "wordTranslation",
    label: "Tradução por palavra",
    description:
      "Toque numa palavra do texto para ver a tradução literal e uma nota de contexto (só texto).",
  },
  {
    key: "phraseTranslation",
    label: "Tradução por frase",
    description:
      "Toque no bloco de tradução da frase para ver o sentido geral, não só o literal (só texto).",
  },
  {
    key: "aiTranslation",
    label: "Tradução inteligente (IA)",
    description:
      "Com internet, usa IA para traduzir no momento do click, entendendo a frase e o tipo de questão. Desligada (ou offline), volta ao dicionário do pack.",
  },
  {
    key: "plusAudio",
    label: "Áudio de pronúncia",
    description:
      "Botão para ouvir a pronúncia do texto em inglês onde naturalmente não há áudio no PTE.",
  },
  {
    key: "vocabCapture",
    label: "Salvar traduções no vocabulário",
    description:
      "Tudo que você traduzir (palavra ou frase) fica salvo em Vocabulário para estudar depois. Desligue se preferir não guardar.",
  },
];
