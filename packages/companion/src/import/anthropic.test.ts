import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnthropicExport } from "./anthropic.js";

function makeExport(messages: object[] = []) {
  return JSON.stringify([
    {
      uuid: "conv-abc",
      name: "Test conversation",
      created_at: "2024-06-01T00:00:00.000000Z",
      updated_at: "2024-06-01T00:01:00.000000Z",
      chat_messages: messages,
    },
  ]);
}

test("parseAnthropicExport maps human→user, assistant→assistant", () => {
  const json = makeExport([
    { uuid: "m1", text: "hello", sender: "human", created_at: "2024-06-01T00:00:10Z" },
    { uuid: "m2", text: "hi there", sender: "assistant", created_at: "2024-06-01T00:00:20Z" },
  ]);
  const turns = [...parseAnthropicExport(json)];
  assert.equal(turns.length, 2);
  assert.equal(turns[0]!.role, "user");
  assert.equal(turns[1]!.role, "assistant");
});

test("parseAnthropicExport sets provider=claude and source=import", () => {
  const json = makeExport([
    { uuid: "m1", text: "hello", sender: "human", created_at: "2024-06-01T00:00:10Z" },
  ]);
  const [t] = [...parseAnthropicExport(json)];
  assert.equal(t!.provider, "claude");
  assert.equal(t!.source, "import");
});

test("parseAnthropicExport preserves providerMessageId", () => {
  const json = makeExport([
    { uuid: "msg-unique-id", text: "hi", sender: "human", created_at: "2024-06-01T00:00:10Z" },
  ]);
  const [t] = [...parseAnthropicExport(json)];
  assert.equal(t!.providerMessageId, "msg-unique-id");
});

test("parseAnthropicExport preserves conversation title", () => {
  const [t] = [...parseAnthropicExport(makeExport([
    { uuid: "m1", text: "hi", sender: "human", created_at: "2024-06-01T00:00:10Z" },
  ]))];
  assert.equal(t!.title, "Test conversation");
});

test("parseAnthropicExport skips messages with empty text", () => {
  const json = makeExport([
    { uuid: "m1", text: "", sender: "human", created_at: "2024-06-01T00:00:10Z" },
    { uuid: "m2", text: "  ", sender: "assistant", created_at: "2024-06-01T00:00:20Z" },
    { uuid: "m3", text: "real content", sender: "human", created_at: "2024-06-01T00:00:30Z" },
  ]);
  const turns = [...parseAnthropicExport(json)];
  assert.equal(turns.length, 1);
  assert.equal(turns[0]!.content, "real content");
});

test("parseAnthropicExport handles multiple conversations", () => {
  const json = JSON.stringify([
    {
      uuid: "c1", name: "A", created_at: "2024-06-01T00:00:00Z",
      chat_messages: [{ uuid: "m1", text: "hi", sender: "human", created_at: "2024-06-01T00:00:01Z" }],
    },
    {
      uuid: "c2", name: "B", created_at: "2024-06-01T00:00:00Z",
      chat_messages: [{ uuid: "m2", text: "hey", sender: "human", created_at: "2024-06-01T00:00:01Z" }],
    },
  ]);
  const turns = [...parseAnthropicExport(json)];
  assert.equal(turns.length, 2);
  assert.equal(new Set(turns.map((t) => t.providerConversationId)).size, 2);
});

test("parseAnthropicExport includes attachment metadata", () => {
  const json = makeExport([
    {
      uuid: "m1", text: "see attachment", sender: "human", created_at: "2024-06-01T00:00:10Z",
      attachments: [{ file_name: "doc.pdf", file_type: "application/pdf", file_size: 12345 }],
    },
  ]);
  const [t] = [...parseAnthropicExport(json)];
  assert.equal(t!.attachments?.length, 1);
  assert.equal(t!.attachments?.[0]?.name, "doc.pdf");
});
