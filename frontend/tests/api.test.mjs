import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, resolveConfig } from "vite";

let server;
let apiModule;
let eventExportModule;
let eventCsvModule;
let originalFetch;

before(async () => {
  server = await createServer({
    configFile: "vite.config.ts",
    server: { middlewareMode: true },
    appType: "custom",
  });
  apiModule = await server.ssrLoadModule("/src/api.ts");
  eventExportModule = await server.ssrLoadModule("/src/eventExport.ts");
  eventCsvModule = await server.ssrLoadModule("/src/eventCsv.ts");
  originalFetch = globalThis.fetch;
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server?.close();
});

test("events sends supported filters and includes credentials", async () => {
  let requestedUrl;
  let requestedInit;
  globalThis.fetch = async (url, init) => {
    requestedUrl = String(url);
    requestedInit = init;
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const api = new apiModule.SafeVisionApi();
  const events = await api.events({ q: "door", prioridad: "Alto", desde: "2026-01-01", camara_id: 7, limit: 50, offset: 0 });

  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/api/eventos");
  assert.equal(url.searchParams.get("q"), "door");
  assert.equal(url.searchParams.get("prioridad"), "Alto");
  assert.equal(url.searchParams.get("desde"), "2026-01-01");
  assert.equal(url.searchParams.get("camara_id"), "7");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(url.searchParams.get("offset"), "0");
  assert.equal(url.searchParams.has("estado"), false);
  assert.equal(requestedInit.credentials, "include");
  assert.deepEqual(events, []);
});

test("reviewEvent uses PATCH and the documented route", async () => {
  let requestedUrl;
  let requestedMethod;
  globalThis.fetch = async (url, init) => {
    requestedUrl = String(url);
    requestedMethod = init.method;
    return new Response(JSON.stringify({ id: 42 }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const event = await new apiModule.SafeVisionApi().reviewEvent(42);
  assert.equal(new URL(requestedUrl).pathname, "/api/eventos/42/revisar");
  assert.equal(requestedMethod, "PATCH");
  assert.equal(event.id, 42);
});

test("backend login and session use the documented cookie-auth routes", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ authenticated: true, user: { id: 8, name: "Sara", email: "sara@example.test" } }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };

  const api = new apiModule.SafeVisionApi();
  const session = await api.login("sara@example.test", "secret");
  await api.currentUser();
  assert.equal(new URL(calls[0].url).pathname, "/api/auth/login");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: "sara@example.test", password: "secret" });
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(session.authenticated, true);
  assert.equal(new URL(calls[1].url).pathname, "/api/auth/me");
});

test("invalid credentials and rate limiting retain their HTTP status for the login UI", async () => {
  const api = new apiModule.SafeVisionApi();
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: "generic backend message" }), { status: 401 });
  await assert.rejects(api.login("user@example.test", "wrong"), error => error instanceof apiModule.ApiError && error.status === 401);

  globalThis.fetch = async () => new Response(JSON.stringify({ detail: "rate limited" }), { status: 429 });
  await assert.rejects(api.login("user@example.test", "password"), error => error instanceof apiModule.ApiError && error.status === 429);
});

test("session restoration rejects an absent backend cookie", async () => {
  let requestedInit;
  globalThis.fetch = async (_url, init) => {
    requestedInit = init;
    return new Response(JSON.stringify({ detail: "Unauthenticated" }), { status: 401 });
  };
  await assert.rejects(new apiModule.SafeVisionApi().currentUser(), error => error instanceof apiModule.ApiError && error.status === 401);
  assert.equal(requestedInit.credentials, "include");
});

test("logout uses the backend endpoint and accepts HTTP 204", async () => {
  let requestedUrl;
  let requestedInit;
  globalThis.fetch = async (url, init) => {
    requestedUrl = String(url);
    requestedInit = init;
    return new Response(null, { status: 204 });
  };
  await new apiModule.SafeVisionApi().logout();
  assert.equal(new URL(requestedUrl).pathname, "/api/auth/logout");
  assert.equal(requestedInit.method, "POST");
  assert.equal(requestedInit.credentials, "include");
});

test("Vite selects local access only for dev serve and the disabled stub for production", async () => {
  const getReplacement = aliases => aliases.find(alias => alias.find === "@safevision/local-dev-access")?.replacement;
  const developmentReplacement = getReplacement(server.config.resolve.alias);
  const productionConfig = await resolveConfig({ configFile: "vite.config.ts" }, "build");
  const productionReplacement = getReplacement(productionConfig.resolve.alias);
  assert.match(developmentReplacement, /localDevAccess\.ts$/);
  assert.match(productionReplacement, /localAccessDisabled\.ts$/);
});

test("WebSocket uses the documented endpoint and a temporary ticket", () => {
  const api = new apiModule.SafeVisionApi();
  const url = new URL(api.alertWebSocketUrl("short-lived-ticket"));
  assert.equal(url.protocol, new URL(api.baseUrl).protocol === "https:" ? "wss:" : "ws:");
  assert.equal(url.pathname, "/ws/alertas");
  assert.equal(url.searchParams.get("ticket"), "short-lived-ticket");
});

test("HTTP errors preserve the response detail and status", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: "forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(
    new apiModule.SafeVisionApi().metrics(),
    error => error instanceof apiModule.ApiError && error.status === 403 && error.message === "forbidden",
  );
});

test("FastAPI validation errors include field paths and messages", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: [
    { loc: ["query", "camara_id"], msg: "Input should be a valid integer" },
    { loc: ["query", "limit"], msg: "Input should be greater than or equal to 1" },
  ] }), { status: 422, headers: { "Content-Type": "application/json" } });

  await assert.rejects(
    new apiModule.SafeVisionApi().metrics(),
    error => error instanceof apiModule.ApiError
      && error.status === 422
      && error.message === "query.camara_id: Input should be a valid integer; query.limit: Input should be greater than or equal to 1",
  );
});

test("CSV export pagination preserves filters and collects every page", async () => {
  const calls = [];
  const fetchPage = async filters => {
    calls.push(filters);
    return filters.offset === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }];
  };

  const events = await eventExportModule.loadAllEvents(fetchPage, { q: "door", camara_id: 7 }, 2);

  assert.deepEqual(events.map(event => event.id), [1, 2, 3]);
  assert.deepEqual(calls, [
    { q: "door", camara_id: 7, limit: 2, offset: 0 },
    { q: "door", camara_id: 7, limit: 2, offset: 2 },
  ]);
});

test("CSV export fails instead of returning a partial file when a later page fails", async () => {
  let calls = 0;
  const fetchPage = async () => {
    calls += 1;
    if (calls === 1) return [{ id: 1 }, { id: 2 }];
    throw new Error("page request failed");
  };

  await assert.rejects(eventExportModule.loadAllEvents(fetchPage, {}, 2), /page request failed/);
  assert.equal(calls, 2);
});

test("CSV export pagination enforces the API maximum", async () => {
  await assert.rejects(
    eventExportModule.loadAllEvents(async () => [], {}, 501),
    RangeError,
  );
});

test("CSV serialization escapes quotes and neutralizes spreadsheet formulas", () => {
  const csv = eventCsvModule.serializeCsvRows([
    ["description", "value"],
    ['Camera "north", entry', "=HYPERLINK(\"https://example.test\")"],
    ["  +cmd", "@SUM(1,2)"],
  ]);

  assert.equal(csv, '\uFEFF"description","value"\r\n"Camera ""north"", entry","\'=HYPERLINK(""https://example.test"")"\r\n"\'  +cmd","\'@SUM(1,2)"');
});
