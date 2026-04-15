import { test } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../server.js";

async function app() {
  return buildServer({
    host: "127.0.0.1",
    port: 0,
    dataDir: "/tmp",
    dbPath: ":memory:",
  });
}

async function seedTurns(a: Awaited<ReturnType<typeof app>>) {
  await a.inject({
    method: "POST",
    url: "/ingest",
    payload: {
      turns: [
        {
          provider: "claude",
          providerConversationId: "c1",
          role: "user",
          content: "the quick brown fox jumps over the lazy dog",
          contentFormat: "markdown",
          source: "live_capture",
        },
        {
          provider: "claude",
          providerConversationId: "c1",
          role: "assistant",
          content: "fascinating! foxes are indeed quick.",
          contentFormat: "markdown",
          source: "live_capture",
        },
        {
          provider: "chatgpt",
          providerConversationId: "c2",
          role: "user",
          content: "what is a lazy evaluation strategy?",
          contentFormat: "markdown",
          source: "live_capture",
        },
      ],
    },
  });
}

test("GET /search returns FTS results", async () => {
  const a = await app();
  await seedTurns(a);

  const r = await a.inject({ method: "GET", url: "/search?q=fox" });
  assert.equal(r.statusCode, 200);
  const body = r.json();
  assert.ok(body.total >= 1);
  assert.ok(body.results.some((res: any) => res.snippet.includes("fox")));
  await a.close();
});

test("GET /search with provider filter", async () => {
  const a = await app();
  await seedTurns(a);

  // "lazy" appears in both claude (the dog) and chatgpt (lazy evaluation)
  const all = await a.inject({ method: "GET", url: "/search?q=lazy" });
  assert.equal(all.json().total, 2);

  const claude = await a.inject({ method: "GET", url: "/search?q=lazy&provider=claude" });
  assert.equal(claude.json().total, 1);
  assert.equal(claude.json().results[0].provider, "claude");
  await a.close();
});

test("GET /search snippet contains mark tags", async () => {
  const a = await app();
  await seedTurns(a);
  const r = await a.inject({ method: "GET", url: "/search?q=fox" });
  const snippets = (r.json().results as Array<{ snippet: string }>).map((x) => x.snippet);
  assert.ok(snippets.some((s) => s.includes("<mark>")));
  await a.close();
});

test("GET /search returns 400 on empty query", async () => {
  const a = await app();
  const r = await a.inject({ method: "GET", url: "/search?q=" });
  assert.equal(r.statusCode, 400);
  await a.close();
});

test("GET /search handles FTS special chars gracefully", async () => {
  const a = await app();
  await seedTurns(a);
  // These would throw in raw FTS5 — should return empty, not 500
  const r = await a.inject({ method: "GET", url: "/search?q=%22%22%22" }); // """
  assert.ok(r.statusCode === 200 || r.statusCode === 400);
  await a.close();
});
