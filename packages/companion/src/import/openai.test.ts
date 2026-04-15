import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOpenAIExport } from "./openai.js";

function makeConv(overrides: Record<string, unknown> = {}) {
  const userNodeId = "node-user";
  const asstNodeId = "node-asst";
  const rootNodeId = "node-root";

  return {
    id: "conv-1",
    title: "My conversation",
    create_time: 1700000000,
    update_time: 1700000100,
    current_node: asstNodeId,
    mapping: {
      [rootNodeId]: {
        id: rootNodeId,
        message: null,
        parent: null,
        children: [userNodeId],
      },
      [userNodeId]: {
        id: userNodeId,
        message: {
          id: "msg-user",
          author: { role: "user" },
          create_time: 1700000010,
          content: { content_type: "text", parts: ["hello world"] },
          status: "finished_successfully",
          metadata: {},
        },
        parent: rootNodeId,
        children: [asstNodeId],
      },
      [asstNodeId]: {
        id: asstNodeId,
        message: {
          id: "msg-asst",
          author: { role: "assistant" },
          create_time: 1700000020,
          content: { content_type: "text", parts: ["hi there!"] },
          status: "finished_successfully",
          metadata: { model_slug: "gpt-4o" },
        },
        parent: userNodeId,
        children: [],
      },
    },
    ...overrides,
  };
}

test("parseOpenAIExport yields user and assistant turns in order", () => {
  const turns = [...parseOpenAIExport(JSON.stringify([makeConv()]))];
  assert.equal(turns.length, 2);
  assert.equal(turns[0]!.role, "user");
  assert.equal(turns[0]!.content, "hello world");
  assert.equal(turns[1]!.role, "assistant");
  assert.equal(turns[1]!.content, "hi there!");
});

test("parseOpenAIExport sets provider=chatgpt and source=import", () => {
  const [t] = [...parseOpenAIExport(JSON.stringify([makeConv()]))];
  assert.equal(t!.provider, "chatgpt");
  assert.equal(t!.source, "import");
});

test("parseOpenAIExport extracts model from assistant message", () => {
  const turns = [...parseOpenAIExport(JSON.stringify([makeConv()]))];
  assert.equal(turns[1]!.model, "gpt-4o");
});

test("parseOpenAIExport skips system and tool messages", () => {
  const conv = makeConv();
  // Add a system node before the user node
  const systemId = "node-system";
  (conv.mapping as Record<string, unknown>)[systemId] = {
    id: systemId,
    message: {
      id: "msg-sys",
      author: { role: "system" },
      create_time: 1700000001,
      content: { content_type: "text", parts: ["You are helpful."] },
      status: "finished_successfully",
      metadata: {},
    },
    parent: "node-root",
    children: ["node-user"],
  };
  const turns = [...parseOpenAIExport(JSON.stringify([conv]))];
  assert.ok(turns.every((t) => t.role === "user" || t.role === "assistant"));
});

test("parseOpenAIExport handles multiple conversations", () => {
  const conv2 = makeConv({ id: "conv-2", title: "Second" });
  const turns = [...parseOpenAIExport(JSON.stringify([makeConv(), conv2]))];
  assert.equal(new Set(turns.map((t) => t.providerConversationId)).size, 2);
});

test("parseOpenAIExport skips messages with empty content", () => {
  const conv = makeConv();
  // Replace user message content with empty string
  (conv.mapping["node-user"]!.message!.content.parts as string[]) = ["   "];
  const turns = [...parseOpenAIExport(JSON.stringify([conv]))];
  assert.ok(turns.every((t) => t.role === "assistant"));
});

test("parseOpenAIExport follows branching via current_node", () => {
  // Add an alternate user message that branches off — current_node should
  // follow the main branch only
  const conv = makeConv();
  const altNodeId = "node-alt";
  (conv.mapping as Record<string, unknown>)[altNodeId] = {
    id: altNodeId,
    message: {
      id: "msg-alt",
      author: { role: "assistant" },
      create_time: 1700000025,
      content: { content_type: "text", parts: ["alternate response"] },
      status: "finished_successfully",
      metadata: { model_slug: "gpt-4o" },
    },
    parent: "node-user",
    children: [],
  };
  (conv.mapping["node-user"]!.children).push(altNodeId);
  // current_node still points to original asstNodeId — alternate not included
  const turns = [...parseOpenAIExport(JSON.stringify([conv]))];
  assert.ok(!turns.some((t) => t.content === "alternate response"));
  assert.ok(turns.some((t) => t.content === "hi there!"));
});
