import { useEffect, useRef } from "react";

/**
 * Foco pós-navegação (projeto 13, §0.3): ao trocar de rota, o título da
 * página recebe o foco — leitores de tela anunciam onde o usuário chegou.
 *
 * Mecanismo: a raiz ARMA a intenção na renderização (antes de as crianças
 * montarem — efeitos de filhos rodam antes dos da raiz) e o h1 da página
 * nova CONSUME a intenção no mount. Focar da raiz não funciona: enquanto a
 * rota nova não chega, o h1 ANTIGO ainda está na árvore, e focar nele é
 * perder o foco quando a troca o remove.
 */
let armed = false;

/** Raiz: arma o foco para o próximo mount de título de página. */
export function armPageFocus(): void {
  armed = true;
}

/** Título de página: consome a intenção (se armada) e foca o elemento. */
export function consumePageFocus(el: HTMLElement | null): void {
  if (!armed) return;
  armed = false;
  el?.focus({ preventScroll: true });
}

/** Hook para o h1 de cada página: ref + consumo no mount. */
export function usePageFocusTarget<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    consumePageFocus(ref.current);
  }, []);
  return ref;
}
