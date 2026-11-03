import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { armPageFocus } from "../lib/pageFocus";
import { applyUpdate, registerServiceWorker, useOfflineStatus } from "../lib/offline";
import { TabBar } from "@/components/layout/TabBar";

function NotFoundComponent() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-6 text-center shadow-card sm:p-10">
        <p className="font-serif text-6xl font-semibold tabular-nums text-primary">404</p>
        <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight text-foreground">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          O endereço que você abriu não existe ou mudou de lugar. O treino continua no início.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-6 shadow-card sm:p-10">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
        >
          <TriangleAlert className="size-6" strokeWidth={2} />
        </span>
        <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Algo deu errado agora. Tente recarregar; se persistir, volte ao início — o progresso
          treinado fica salvo neste navegador.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PTE Master Hub — treino de PTE Academic" },
      {
        name: "description",
        content:
          "Treine o PTE Academic com questões para praticar nas quatro seções da prova — progresso salvo no seu navegador.",
      },
      { name: "author", content: "PTE Master Hub" },
      { property: "og:title", content: "PTE Master Hub" },
      {
        property: "og:description",
        content: "Treine o PTE Academic com questões para praticar — fala, escuta, leitura e escuta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Tipografia da marca (projeto 12, D3): Fraunces (display) + Inter (UI).
      // Via <link> aqui — nunca @import remoto no styles.css.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Tema pré-pintura (projeto 13, D11): aplica .dark antes da 1ª pintura —
            sem flash. Fonte única com src/lib/theme.ts (THEME_KEY / regra resolvida). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var m=localStorage.getItem("ptehub:theme");var d=m==="dark"||((!m||m==="system")&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d){r.classList.add("dark");r.style.colorScheme="dark"}else{r.style.colorScheme="light"}}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function UpdateBanner() {
  const o = useOfflineStatus();
  if (!o.updateReady) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+1rem)] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-card p-4 text-sm shadow-pop transition-colors md:bottom-4 motion-reduce:transition-none"
    >
      <span className="flex min-w-0 items-center gap-2">
        <RefreshCw aria-hidden className="size-4 shrink-0 text-primary" />
        <span className="min-w-0">Nova versão disponível.</span>
      </span>
      <button
        onClick={applyUpdate}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Recarregar
      </button>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastPath = useRef<string | null>(null);
  useEffect(() => registerServiceWorker(), []);

  // Projeto 13 (§0.3): foco pós-navegação — a raiz ARMA a intenção na
  // renderização (antes de as crianças montarem); o h1 da página nova
  // consome no mount via consumePageFocus (src/lib/pageFocus.ts). A carga
  // inicial não arma (nada rouba o foco na entrada).
  if (lastPath.current === null) {
    lastPath.current = pathname;
  } else if (lastPath.current !== pathname) {
    armPageFocus();
    lastPath.current = pathname;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* Skip link (projeto 13, §0.3): visível só ao foco; foca o h1 explicitamente. */}
      <a
        href="#page-title"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("page-title")?.focus({ preventScroll: true });
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[70] focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-pop focus:outline-none"
      >
        Pular para o conteúdo
      </a>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {/* Tab bar mobile (PRD §6.2, D6): uma única montagem global — todas as rotas a herdam. */}
      <TabBar />
      <UpdateBanner />
    </QueryClientProvider>
  );
}
