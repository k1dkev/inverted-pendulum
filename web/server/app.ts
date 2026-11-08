import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { Bridge } from "./bridge";
import { Transport } from "./transport";

export async function createApp(
  options: { mock?: boolean; dev?: boolean } = {},
) {
  const bridge = new Bridge(options.mock);
  const root = fileURLToPath(new URL("..", import.meta.url)),
    dist = resolve(root, "dist");
  let middleware:
    | ((
        req: import("node:http").IncomingMessage,
        res: import("node:http").ServerResponse,
      ) => void)
    | undefined;
  const server = createServer(async (req, res) => {
    const host = req.headers.host ?? "";
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) {
      res.writeHead(403).end();
      return;
    }
    const pathname = new URL(req.url ?? "/", `http://${host}`).pathname;
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (pathname === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.end('{"ok":true}');
      return;
    }
    if (pathname === "/api/ports") {
      try {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(await Transport.ports(!!options.mock)));
      } catch {
        res.writeHead(503).end('{"error":"Unable to enumerate serial ports"}');
      }
      return;
    }
    if (middleware) {
      middleware(req, res);
      return;
    }
    try {
      const path = resolve(
        dist,
        "." + decodeURIComponent(pathname === "/" ? "/index.html" : pathname),
      );
      if (!path.startsWith(dist + "/")) {
        res.writeHead(403).end();
        return;
      }
      const content = await readFile(path);
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
      };
      res.setHeader(
        "Content-Type",
        mime[extname(path)] ?? "application/octet-stream",
      );
      res.end(content);
    } catch {
      res.writeHead(404).end("Not found. Run npm run build before npm start.");
    }
  });
  let vite: import("vite").ViteDevServer | undefined;
  if (options.dev) {
    const { createServer: createVite } = await import("vite");
    vite = await createVite({
      root,
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    middleware = (req, res) => vite!.middlewares(req, res);
  }
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws") {
      if (!vite) socket.destroy(); // Vite owns its HMR upgrades in development.
      return;
    }
    const host = req.headers.host ?? "";
    if (
      !/^(localhost|127\.0\.0\.1):\d+$/.test(host) ||
      req.headers.origin !== `http://${host}`
    ) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => bridge.add(ws));
  });
  return {
    server,
    bridge,
    async close() {
      await bridge.close();
      wss.close();
      await vite?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
