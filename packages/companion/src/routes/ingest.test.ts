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

test("POST /ingest single turn + GET /conversations round-trip", async () => {
  const a = await app();
  const ingest = await a.inject({
    method: "POST",
    url: "/ingest",
    payload: {
      provider: "claude",
      providerConversationId: "abc",
      role: "user",
      content: "hello",
      contentFormat: "markdown",
      source: "live_capture",
    },
  });
  assert.equal(ingest.statusCode, 200);
  const body = ingest.json();
  assert.equal(body.ingested, 1);

  const list = await a.inject({ method: "GET", url: "/conversations" });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().conversations.length, 1);

  await a.close();
});

test("POST /ingest batch", async () => {
  const a = await app();
  const r = await a.inject({
    method: "POST",
    url: "/ingest",
    payload: {
      turns: [
        {
          provider: "claude",
          providerConversationId: "x",
          role: "user",
          content: "q",
          contentFormat: "markdown",
          source: "live_capture",
        },
        {
          provider: "claude",
          providerConversationId: "x",
          role: "assistant",
          content: "a",
          contentFormat: "markdown",
          source: "live_capture",
        },
      ],
    },
  });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().ingested, 2);
  await a.close();
});

test("POST /ingest rejects invalid body", async () => {
  const a = await app();
  const r = await a.inject({
    method: "POST",
    url: "/ingest",
    payload: { provider: "nope" },
  });
  assert.equal(r.statusCode, 400);
  await a.close();
});
