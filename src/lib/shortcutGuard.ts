/**
 * Guard de atalhos globais (projeto 13, §0.3/D10): quando um modal está
 * aberto, os atalhos da prática (setas, J/K, B, N) NÃO devem trocar de
 * questão nem disparar ações — o modal é a interação ativa. Extraído como
 * predicado puro para ser testável sem montar o shell inteiro.
 */
export function isModalOpen(doc: Document = document): boolean {
  return doc.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

/**
 * Deve o atalho global ser ignorado? Verdadeiro quando:
 *  - outro handler já tratou o evento (`defaultPrevented`);
 *  - um modal está aberto (dialog com aria-modal, ex.: TranslationSheet);
 *  - o foco está em campo de texto (o chamador já tratava).
 */
export function shouldSkipShortcut(e: KeyboardEvent, doc: Document = document): boolean {
  if (e.defaultPrevented) return true;
  if (isModalOpen(doc)) return true;
  const t = e.target as HTMLElement | null;
  return Boolean(
    t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable),
  );
}
