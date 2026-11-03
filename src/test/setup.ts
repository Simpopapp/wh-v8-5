import "@testing-library/jest-dom/vitest";

// React 19 suspende a renderização até as folhas de estilo (<link
// rel="stylesheet">) carregarem. O jsdom nunca as carrega, o que deixava os
// testes de rota completa presos em "pending". Simulamos o evento de load.
const agendados = new WeakSet<HTMLLinkElement>();
const carregados = new WeakSet<HTMLLinkElement>();

const originalCreateElement = document.createElement.bind(document);

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options?: ElementCreationOptions,
): HTMLElementTagNameMap[K] {
  const el = originalCreateElement(tagName, options);
  if (tagName === "link") {
    const link = el as HTMLLinkElement;
    if (!agendados.has(link)) {
      agendados.add(link);
      setTimeout(() => {
        if (!carregados.has(link)) {
          carregados.add(link);
          link.dispatchEvent(new Event("load"));
        }
      }, 0);
    }
  }
  return el;
}

document.createElement = createElement as unknown as typeof document.createElement;

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
