import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "./index.js";
import { Repo } from "./repo.js";

function freshRepo() {
  const db = openDb(":memory:");
  return { db, repo: new Repo(db) };
}

test("ingestTurn creates conversation and message", () => {
  const { repo } = freshRepo();
  const res = repo.ingestTurn({
    provider: "claude",
    providerConversationId: "claude-abc",
    role: "user",
    content: "hello world",
    contentFormat: "markdown",
    source: "live_capture",
  });
  assert.equal(res.deduplicated, false);
  const conv = repo.getConversation(res.conversationId);
  assert.ok(conv);
  assert.equal(conv!.provider, "claude");
  assert.equal(conv!.messageCount, 1);
});

test("dedup by providerMessageId", () => {
  const { repo } = freshRepo();
  const turn = {
    provider: "claude" as const,
    providerConversationId: "c1",
    providerMessageId: "m1",
    role: "assistant" as const,
    content: "hi",
    contentFormat: "markdown" as const,
    source: "live_capture" as const,
  };
  const a = repo.ingestTurn(turn);
  const b = repo.ingestTurn({ ...turn, content: "different content but same id" });
  assert.equal(b.deduplicated, true);
  assert.equal(a.messageId, b.messageId);
});

test("dedup by content hash when no providerMessageId", () => {
  const { repo } = freshRepo();
  const turn = {
    provider: "chatgpt" as const,
    providerConversationId: "c2",
    role: "user" as const,
    content: "exact duplicate",
    contentFormat: "markdown" as const,
    source: "live_capture" as const,
  };
  const a = repo.ingestTurn(turn);
  const b = repo.ingestTurn(turn);
  assert.equal(b.deduplicated, true);
  assert.equal(a.messageId, b.messageId);
});

test("FTS search finds messages", () => {
  const { db, repo } = freshRepo();
  repo.ingestTurn({
    provider: "claude",
    providerConversationId: "c3",
    role: "user",
    content: "the quick brown fox jumps",
    contentFormat: "markdown",
    source: "live_capture",
  });
  repo.ingestTurn({
    provider: "claude",
    providerConversationId: "c3",
    role: "assistant",
    content: "a lazy dog sleeps",
    contentFormat: "markdown",
    source: "live_capture",
  });
  const hits = db
    .prepare("SELECT rowid FROM message_fts WHERE message_fts MATCH ?")
    .all("fox") as { rowid: number }[];
  assert.equal(hits.length, 1);
});

test("listConversations orders by updated_at desc", () => {
  const { repo } = freshRepo();
  repo.ingestTurn({
    provider: "claude",
    providerConversationId: "old",
    role: "user",
    content: "a",
    contentFormat: "markdown",
    source: "live_capture",
    createdAt: "2020-01-01T00:00:00.000Z",
  });
  repo.ingestTurn({
    provider: "claude",
    providerConversationId: "new",
    role: "user",
    content: "b",
    contentFormat: "markdown",
    source: "live_capture",
  });
  const list = repo.listConversations({ limit: 10, offset: 0 });
  assert.equal(list[0]!.providerConversationId, "new");
});
