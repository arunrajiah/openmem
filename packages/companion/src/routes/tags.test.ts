import { test } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../server.js";

async function app() {
  return buildServer({ host: "127.0.0.1", port: 0, dataDir: "/tmp", dbPath: ":memory:" });
}

async function seedConv(a: Awaited<ReturnType<typeof app>>) {
  const r = await a.inject({
    method: "POST", url: "/ingest",
    payload: { provider: "claude", providerConversationId: "c1", role: "user",
               content: "hello", contentFormat: "markdown", source: "live_capture" },
  });
  return r.json().results[0].conversationId as string;
}

test("PUT /conversations/:id/tags sets tags, GET /tags returns them", async () => {
  const a = await app();
  const id = await seedConv(a);

  const set = await a.inject({
    method: "PUT", url: `/conversations/${id}/tags`,
    payload: { tags: ["work", "important"] },
  });
  assert.equal(set.statusCode, 200);

  const list = await a.inject({ method: "GET", url: "/tags" });
  const tags = list.json().tags as Array<{ tag: string; count: number }>;
  assert.ok(tags.some((t) => t.tag === "work"));
  assert.ok(tags.some((t) => t.tag === "important"));
  await a.close();
});

test("PUT /conversations/:id/tags deduplicates and trims", async () => {
  const a = await app();
  const id = await seedConv(a);
  await a.inject({ method: "PUT", url: `/conversations/${id}/tags`,
                   payload: { tags: ["  dup  ", "dup", "unique"] } });

  const conv = await a.inject({ method: "GET", url: `/conversations/${id}` });
  const tags: string[] = conv.json().conversation.tags;
  assert.equal(tags.filter((t) => t === "dup").length, 1);
  assert.equal(tags.length, 2); // dup + unique
  await a.close();
});

test("GET /conversations?tag= filters by tag", async () => {
  const a = await app();
  const id1 = await seedConv(a);
  // Second conversation
  const r2 = await a.inject({
    method: "POST", url: "/ingest",
    payload: { provider: "chatgpt", providerConversationId: "c2", role: "user",
               content: "hi", contentFormat: "markdown", source: "live_capture" },
  });
  const id2 = r2.json().results[0].conversationId;

  await a.inject({ method: "PUT", url: `/conversations/${id1}/tags`,
                   payload: { tags: ["tagged"] } });

  const filtered = await a.inject({ method: "GET", url: "/conversations?tag=tagged" });
  assert.equal(filtered.json().conversations.length, 1);
  assert.equal(filtered.json().conversations[0].id, id1);

  const untagged = await a.inject({ method: "GET", url: "/conversations?tag=nope" });
  assert.equal(untagged.json().conversations.length, 0);
  void id2;
  await a.close();
});

test("PUT /conversations/:id/tags returns 404 for unknown id", async () => {
  const a = await app();
  const r = await a.inject({ method: "PUT", url: "/conversations/unknown/tags",
                              payload: { tags: ["x"] } });
  assert.equal(r.statusCode, 404);
  await a.close();
});

test("GET /stats returns conversation and message counts", async () => {
  const a = await app();
  await a.inject({
    method: "POST", url: "/ingest",
    payload: { turns: [
      { provider: "claude", providerConversationId: "s1", role: "user",
        content: "a", contentFormat: "markdown", source: "live_capture" },
      { provider: "chatgpt", providerConversationId: "s2", role: "user",
        content: "b", contentFormat: "markdown", source: "live_capture" },
    ]},
  });
  const r = await a.inject({ method: "GET", url: "/stats" });
  assert.equal(r.statusCode, 200);
  const s = r.json();
  assert.equal(s.conversations, 2);
  assert.equal(s.messages, 2);
  assert.ok(typeof s.dbSizeBytes === "number" && s.dbSizeBytes > 0);
  await a.close();
});

test("GET /conversations/:id/export.md returns markdown", async () => {
  const a = await app();
  const id = await seedConv(a);
  const r = await a.inject({ method: "GET", url: `/conversations/${id}/export.md` });
  assert.equal(r.statusCode, 200);
  assert.ok(r.headers["content-type"]?.toString().includes("markdown"));
  assert.ok(r.body.includes("## **You**") || r.body.includes("### **You**"));
  assert.ok(r.body.includes("hello"));
  await a.close();
});
