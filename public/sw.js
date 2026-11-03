// Service worker v3 (projeto 9, Fase 6).
//  - install: precache do shell; NÃO assume o controle sozinho quando já há uma versão ativa
//    (o app mostra "Nova versão disponível" e envia SKIP_WAITING quando o aluno aceita);
//  - /assets/* (arquivos com hash, inclui os bancos de questões): cache-first;
//  - navegação (HTML): rede primeiro; sem rede, última cópia dessa página (ou a Home).
// Mude VERSION a cada mudança deste arquivo — o navegador só detecta SW novo se os bytes mudarem.
const VERSION = "3";
const CACHE = `pte-master-hub-v${VERSION}`;
const PRECACHE = [
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
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((u) =>
            cache.add(new Request(u, { cache: "reload" })).catch(() => undefined),
          ),
        ),
      )
      .then(() => {
        // Primeira instalação: assume já. Atualização: espera o aluno aceitar.
        if (!self.registration.active) return self.skipWaiting();
      }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("pte-master-hub-") && k !== CACHE)
            .map(async (old) => {
              // Leva os /assets/ já baixados para o cache novo (hash = imutável) antes de apagar.
              const from = await caches.open(old);
              const to = await caches.open(CACHE);
              for (const req of await from.keys()) {
                if (new URL(req.url).pathname.startsWith("/assets/")) {
                  const res = await from.match(req);
                  if (res) await to.put(req, res);
                }
              }
              await caches.delete(old);
            }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  const isPage =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html") ||
    !url.pathname.includes(".");
  if (isPage) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(
          async () =>
            (await caches.match(url.pathname)) ?? (await caches.match("/")) ?? Response.error(),
        ),
    );
  }
});
