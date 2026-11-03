// Fase 6 (projeto 9): offline real.
//  - registra /sw.js (só em produção, nunca no dev/preview do Vite);
//  - "Baixar para offline": importa cada banco de questões (o SW guarda os chunks /assets/*)
//    e visita as rotas das seções (o SW guarda o HTML) — tipos nunca visitados passam a abrir sem rede;
//  - nova versão: o SW novo fica "esperando"; o app avisa e só troca quando o aluno aceita.
import { useSyncExternalStore } from "react";

import { ALL_TASK_TYPES, loadTypeQuestions } from "@/lib/pte/catalog";
import { TYPE_META, type TaskType } from "@/lib/pte/types";

export const OFFLINE_ROUTES = [
  "/",
  "/speaking",
  "/writing",
  "/reading",
  "/listening",
  "/practice",
  "/session",
  "/progress",
  "/exam",
  "/settings",
];

type Status = {
  supported: boolean;
  updateReady: boolean;
  downloading: boolean;
  done: number;
  total: number;
  lastDownloadAt: number | null;
  error: string | null;
};

const KEY = "pte-offline-downloaded-at";
let status: Status = {
  supported: false,
  updateReady: false,
  downloading: false,
  done: 0,
  total: 0,
  lastDownloadAt: null,
  error: null,
};
const listeners = new Set<() => void>();
function set(patch: Partial<Status>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}
let waiting: ServiceWorker | null = null;

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const last = Number(localStorage.getItem(KEY));
  set({ supported: true, lastDownloadAt: Number.isFinite(last) && last > 0 ? last : null });
  if (import.meta.env.DEV) return;
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      const track = (w: ServiceWorker | null) => {
        if (!w) return;
        const check = () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            waiting = w;
            set({ updateReady: true });
          }
        };
        check();
        w.addEventListener("statechange", check);
      };
      track(reg.waiting);
      reg.addEventListener("updatefound", () => track(reg.installing));
    })
    .catch(() => undefined);
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded || !waiting) return;
    reloaded = true;
    window.location.reload();
  });
}

export function applyUpdate() {
  waiting?.postMessage({ type: "SKIP_WAITING" });
}

/** Baixa tipos (padrão: todos) + rotas. Retorna quantos itens falharam. */
export async function downloadForOffline(types: TaskType[] = ALL_TASK_TYPES): Promise<number> {
  if (status.downloading) return 0;
  const routes = OFFLINE_ROUTES;
  const total = types.length + routes.length;
  set({ downloading: true, done: 0, total, error: null });
  let failed = 0;
  let done = 0;
  const tick = () => set({ done: ++done });
  for (const t of types) {
    await loadTypeQuestions(t).catch(() => failed++);
    tick();
  }
  for (const r of routes) {
    await fetch(r, { credentials: "same-origin" }).catch(() => failed++);
    tick();
  }
  const now = Date.now();
  if (!failed) localStorage.setItem(KEY, String(now));
  set({
    downloading: false,
    lastDownloadAt: failed ? status.lastDownloadAt : now,
    error: failed ? `${failed} item(ns) não baixaram — verifique a conexão e tente de novo.` : null,
  });
  return failed;
}

export function typesOfSection(section: string): TaskType[] {
  return ALL_TASK_TYPES.filter((t) => TYPE_META[t].section === section);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER: Status = { ...status };
export function useOfflineStatus(): Status {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => SERVER,
  );
}
