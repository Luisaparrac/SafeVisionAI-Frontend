import { fileURLToPath, URL } from "node:url";
import { randomBytes } from "node:crypto";
import { defineConfig, loadEnv } from "vite";

const LOCAL_AUTH_PREFIX = "/__safevision/local-dev";
const LOCAL_AUTH_COOKIE = "safevision_local_dev_session";
const FRONTEND_ROOT = fileURLToPath(new URL(".", import.meta.url));

function localDevAuthPlugin(env: Record<string, string>) {
  const configuredEmail = env.SAFEVISION_LOCAL_DEV_EMAIL?.trim().toLowerCase();
  const configuredPassword = env.SAFEVISION_LOCAL_DEV_PASSWORD;
  const sessions = new Set<string>();

  return {
    name: "safevision-local-dev-auth",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith(LOCAL_AUTH_PREFIX)) return next();

        let host = "";
        try { host = new URL(`http://${request.headers.host ?? ""}`).hostname.replace(/^\[|\]$/g, "").toLowerCase(); }
        catch { response.writeHead(400).end(); return; }
        const remoteAddress = request.socket.remoteAddress ?? "";
        const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(host ?? "")
          && (remoteAddress === "::1" || remoteAddress === "127.0.0.1" || remoteAddress.startsWith("::ffff:127."));
        if (!isLoopback) {
          response.writeHead(403).end();
          return;
        }

        const origin = request.headers.origin;
        if (origin) {
          try {
            if (new URL(origin).host !== request.headers.host) { response.writeHead(403).end(); return; }
          } catch { response.writeHead(403).end(); return; }
        }

        const sendJson = (status: number, body: unknown) => {
          response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
          response.end(JSON.stringify(body));
        };
        const cookie = request.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(`${LOCAL_AUTH_COOKIE}=`));
        const token = cookie?.slice(LOCAL_AUTH_COOKIE.length + 1);

        if (url.pathname === `${LOCAL_AUTH_PREFIX}/status` && request.method === "GET") {
          sendJson(200, { configured: Boolean(configuredEmail && configuredPassword) });
          return;
        }
        if (url.pathname === `${LOCAL_AUTH_PREFIX}/session` && request.method === "GET") {
          sendJson(200, { authenticated: Boolean(token && sessions.has(token)) });
          return;
        }
        if (url.pathname === `${LOCAL_AUTH_PREFIX}/logout` && request.method === "POST") {
          if (token) sessions.delete(token);
          response.writeHead(204, { "Set-Cookie": `${LOCAL_AUTH_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`, "Cache-Control": "no-store" });
          response.end();
          return;
        }
        if (url.pathname !== `${LOCAL_AUTH_PREFIX}/login` || request.method !== "POST") {
          sendJson(404, { message: "Not found" });
          return;
        }
        if (!configuredEmail || !configuredPassword) {
          sendJson(503, { message: "Local development access is not configured." });
          return;
        }

        let body = "";
        let tooLarge = false;
        request.setEncoding("utf8");
        request.on("data", (chunk: string) => {
          if (tooLarge) return;
          body += chunk;
          if (body.length > 4096) {
            tooLarge = true;
            response.writeHead(413).end();
          }
        });
        request.on("end", () => {
          if (tooLarge) return;
          let credentials: { email?: unknown; password?: unknown };
          try { credentials = JSON.parse(body) as typeof credentials; }
          catch { sendJson(400, { message: "Invalid request." }); return; }
          if (typeof credentials.email !== "string" || typeof credentials.password !== "string"
            || credentials.email.trim().toLowerCase() !== configuredEmail || credentials.password !== configuredPassword) {
            sendJson(401, { message: "Invalid local development credentials." });
            return;
          }
          const newToken = randomBytes(32).toString("hex");
          sessions.add(newToken);
          response.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "Set-Cookie": `${LOCAL_AUTH_COOKIE}=${newToken}; HttpOnly; SameSite=Strict; Path=/`,
          });
          response.end(JSON.stringify({ authenticated: true }));
        });
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isDevelopmentServer = command === "serve";
  // Keep custom local credentials on the Node side and resolve the env directory
  // from this config file, even when Vite is started from the repository root.
  const env = isDevelopmentServer ? loadEnv(mode, FRONTEND_ROOT, "") : {};
  return {
    plugins: isDevelopmentServer ? [localDevAuthPlugin(env)] : [],
    resolve: {
      alias: {
        "@safevision/local-dev-access": fileURLToPath(new URL(
          command === "serve" ? "./src/localDevAccess.ts" : "./src/localAccessDisabled.ts",
          import.meta.url,
        )),
      },
    },
  };
});
