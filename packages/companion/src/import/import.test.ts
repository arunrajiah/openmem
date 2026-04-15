/**
 * Integration test: runImport end-to-end via in-memory DB.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDb } from "../db/index.js";
import { Repo } from "../db/repo.js";
import { runImport } from "./index.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `openmem-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

test("runImport openai: imports conversations from JSON file", async () => {
  const db = openDb(":memory:");
  const repo = new Repo(db);
  const dir = makeTempDir();

  const conv = {
    id: "oa-conv-1",
    title: "Test",
    create_time: 1700000000,
    update_time: 1700000100,
    current_node: "n-asst",
    mapping: {
      "n-root": { id: "n-root", message: null, parent: null, children: ["n-user"] },
      "n-user": {
        id: "n-user",
        message: { id: "m-user", author: { role: "user" }, create_time: 1700000010,
          content: { content_type: "text", parts: ["hello"] },
          status: "finished_successfully", metadata: {} },
        parent: "n-root", children: ["n-asst"],
      },
      "n-asst": {
        id: "n-asst",
        message: { id: "m-asst", author: { role: "assistant" }, create_time: 1700000020,
          content: { content_type: "text", parts: ["hi!"] },
          status: "finished_successfully", metadata: { model_slug: "gpt-4o" } },
        parent: "n-user", children: [],
      },
    },
  };

  writeFileSync(join(dir, "conversations.json"), JSON.stringify([conv]));

  const result = await runImport("openai", join(dir, "conversations.json"), repo);
  rmSync(dir, { recursive: true });
  db.close();

  assert.equal(result.conversations, 1);
  assert.equal(result.messages, 2);
  assert.equal(result.errors.length, 0);
});

test("runImport anthropic: imports from JSON file", async () => {
  const db = openDb(":memory:");
  const repo = new Repo(db);
  const dir = makeTempDir();

  const data = [
    {
      uuid: "anth-conv-1",
      name: "Hello",
      created_at: "2024-01-01T00:00:00Z",
      chat_messages: [
        { uuid: "m1", text: "hi claude", sender: "human", created_at: "2024-01-01T00:00:01Z" },
        { uuid: "m2", text: "hello!", sender: "assistant", created_at: "2024-01-01T00:00:02Z" },
      ],
    },
  ];

  writeFileSync(join(dir, "conversations.json"), JSON.stringify(data));

  const result = await runImport("anthropic", join(dir, "conversations.json"), repo);
  rmSync(dir, { recursive: true });
  db.close();

  assert.equal(result.conversations, 1);
  assert.equal(result.messages, 2);
  assert.equal(result.errors.length, 0);
});

test("runImport deduplication: re-importing same file yields no new messages", async () => {
  const db = openDb(":memory:");
  const repo = new Repo(db);
  const dir = makeTempDir();

  const data = [
    {
      uuid: "anth-conv-dedup",
      name: "Dedup test",
      created_at: "2024-01-01T00:00:00Z",
      chat_messages: [
        { uuid: "mX", text: "test", sender: "human", created_at: "2024-01-01T00:00:01Z" },
      ],
    },
  ];

  const filePath = join(dir, "conversations.json");
  writeFileSync(filePath, JSON.stringify(data));

  const first = await runImport("anthropic", filePath, repo);
  const second = await runImport("anthropic", filePath, repo);
  rmSync(dir, { recursive: true });
  db.close();

  assert.equal(first.messages, 1);
  assert.equal(second.messages, 0);
  assert.equal(second.deduplicated, 1);
});

test("runImport gemini: imports Shape A transcript", async () => {
  const db = openDb(":memory:");
  const repo = new Repo(db);
  const dir = makeTempDir();

  const data = {
    conversations: [
      {
        id: "g-conv-1",
        title: "Gemini chat",
        createTime: "2024-06-01T00:00:00Z",
        turns: [
          { role: "user", text: "hello gemini" },
          { role: "model", text: "hello human" },
        ],
      },
    ],
  };

  writeFileSync(join(dir, "Gemini Apps Activity.json"), JSON.stringify(data));

  const result = await runImport("gemini", join(dir, "Gemini Apps Activity.json"), repo);
  rmSync(dir, { recursive: true });
  db.close();

  assert.equal(result.conversations, 1);
  assert.equal(result.messages, 2);
  assert.equal(result.errors.length, 0);
});

test("runImport: missing file returns error, no throw", async () => {
  const db = openDb(":memory:");
  const repo = new Repo(db);
  const result = await runImport("openai", "/does/not/exist.zip", repo);
  db.close();
  assert.ok(result.errors.length > 0);
  assert.equal(result.messages, 0);
});
