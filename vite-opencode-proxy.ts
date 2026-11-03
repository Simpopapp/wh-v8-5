import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";

// OpenCode web runs as a local process inside the sandbox. The preview is only reachable
// over https on port 8080, so its UI + API are exposed through this same-origin dev proxy.
const TARGET = process.env["OPENCODE_URL"] ?? "http://127.0.0.1:4096";
const { hostname, port } = new URL(TARGET);

// Root paths owned by the OpenCode server (SPA assets + HTTP/SSE API).
// /api/* entries are listed one by one so the app's own /api routes keep working.
const PREFIXES = [
  "/oc",
  "/new-session",
  "/new-project",
  "/assets/",
  "/doc",
  "/event",
  "/config",
  "/global/",
  "/instance/",
  "/session",
  "/project",
  "/file",
  "/find",
  "/formatter",
  "/log",
  "/lsp",
  "/mcp",
  "/permission",
  "/question",
  "/path",
  "/skill",
  "/agent",
  "/command",
  "/provider",
  "/pty",
  "/sync/",
  "/tui/",
  "/vcs",
  "/experimental/",
  "/auth/",
  "/site.webmanifest",
  "/favicon-96x96-v3.png",
  "/favicon-v3.svg",
  "/favicon-v3.ico",
  "/apple-touch-icon-v3.png",
  "/api/session",
  "/api/event",
  "/api/agent",
  "/api/command",
  "/api/config",
  "/api/credential",
  "/api/fs/",
  "/api/health",
  "/api/integration",
  "/api/location",
  "/api/model",
  "/api/permission",
  "/api/provider",
  "/api/pty",
  "/api/question",
  "/api/reference",
  "/api/skill",
];

function targetPath(url: string): string | undefined {
  const path = url.split("?")[0] ?? "";
  if (path === "/oc" || path.startsWith("/oc/")) {
    const rest = url.slice(3);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return PREFIXES.some((p) => path === p || path.startsWith(p)) ? url : undefined;
}

export function opencodeProxy(): Plugin {
  return {
    name: "studio-os-opencode-proxy",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      const handler = (
        req: IncomingMessage,
        res: ServerResponse,
        next: (err?: unknown) => void,
      ) => {
        const mapped = req.url ? targetPath(req.url) : undefined;
        if (!mapped) return next();
        // The app owns the /session page (browser navigation); OpenCode keeps its /session API.
        const path = (req.url ?? "").split("?")[0];
        if (
          path === "/session" &&
          req.method === "GET" &&
          (req.headers.accept ?? "").includes("text/html")
        ) {
          return next();
        }

        const headers = { ...req.headers, host: `${hostname}:${port}` };
        const upstream = http.request(
          { hostname, port, path: mapped, method: req.method, headers },
          (upstreamRes) => {
            res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
            upstreamRes.pipe(res);
          },
        );
        upstream.on("error", () => {
          if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
          res.end("OpenCode indisponível");
        });
        req.pipe(upstream);
      };

      // Run before Vite's SSR/app middlewares so OpenCode paths are never handled by the app.
      server.middlewares.use(handler);
      const stack = server.middlewares.stack;
      const entry = stack.pop();
      if (entry) stack.unshift(entry);
    },
  };
}
