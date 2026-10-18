import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server;
let apiModule;
let eventExportModule;
let originalFetch;

before(async () => {
  server = await createServer({
    configFile: "vite.config.ts",
    server: { middlewareMode: true },
    appType: "custom",
  });
  apiModule = await server.ssrLoadModule("/src/api.ts");
  eventExportModule = await server.ssrLoadModule("/src/eventExport.ts");
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
