import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isClaudeCompletionUrl,
  extractConversationId,
  parseUserTurn,
  parseAssistantSSE,
} from "./parser.js";

// ── URL helpers ────────────────────────────────────────────────────────────────

test("isClaudeCompletionUrl matches completion endpoint", () => {
  const url =
    "https://claude.ai/api/organizations/org-abc/chat_conversations/conv-xyz/completion";
  assert.equal(isClaudeCompletionUrl(url), true);
});

test("isClaudeCompletionUrl rejects other paths", () => {
  assert.equal(isClaudeCompletionUrl("https://claude.ai/chat/conv-xyz"), false);
  assert.equal(isClaudeCompletionUrl("https://chatgpt.com/api/chat"), false);
});

test("extractConversationId parses UUID from URL", () => {
  const url =
    "https://claude.ai/api/organizations/org-abc/chat_conversations/abc123/completion";
  assert.equal(extractConversationId(url), "abc123");
});

// ── User turn parsing ──────────────────────────────────────────────────────────

test("parseUserTurn extracts from messages array", () => {
  const req = {
    messages: [
      { role: "user", content: "hello world" },
      { role: "assistant", content: "hi there" },
      { role: "user", content: "what is 2+2?" },
    ],
    model: "claude-3-5-sonnet-20241022",
  };
  const turn = parseUserTurn("conv-1", req, "2024-01-01T00:00:00.000Z");
  assert.ok(turn);
  assert.equal(turn!.role, "user");
  assert.equal(turn!.content, "what is 2+2?");
  assert.equal(turn!.model, "claude-3-5-sonnet-20241022");
});

test("parseUserTurn extracts from content block array", () => {
  const req = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "explain this code" },
          { type: "tool_result", tool_use_id: "t1" }, // no text — ignored
        ],
      },
    ],
  };
  const turn = parseUserTurn("conv-1", req, "2024-01-01T00:00:00.000Z");
  assert.ok(turn);
  assert.equal(turn!.content, "explain this code");
});

test("parseUserTurn extracts from legacy prompt string", () => {
  const req = {
    prompt: "\n\nHuman: what is TypeScript?\n\nAssistant:",
  };
  const turn = parseUserTurn("conv-1", req, "2024-01-01T00:00:00.000Z");
  assert.ok(turn);
  assert.equal(turn!.content, "what is TypeScript?");
});

test("parseUserTurn returns null when no user message", () => {
  const turn = parseUserTurn("conv-1", {}, "2024-01-01T00:00:00.000Z");
  assert.equal(turn, null);
});

// ── Assistant SSE parsing ──────────────────────────────────────────────────────

function makeSse(events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

const SAMPLE_SSE = makeSse([
  {
    type: "message_start",
    message: { id: "msg_abc", role: "assistant", model: "claude-3-5-sonnet-20241022" },
  },
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: ", world!" } },
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 5 } },
  { type: "message_stop" },
]);

test("parseAssistantSSE reconstructs full content", () => {
  const result = parseAssistantSSE("conv-1", SAMPLE_SSE);
  assert.ok(result);
  assert.equal(result!.turn.content, "Hello, world!");
  assert.equal(result!.turn.role, "assistant");
  assert.equal(result!.turn.model, "claude-3-5-sonnet-20241022");
  assert.equal(result!.turn.providerMessageId, "msg_abc");
  assert.equal(result!.turn.tokensEstimate, 5);
});

test("parseAssistantSSE handles multiple text blocks in order", () => {
  const sse = makeSse([
    {
      type: "message_start",
      message: { id: "m1", role: "assistant", model: "claude-3" },
    },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "block0" } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "block1" } },
    { type: "content_block_stop", index: 1 },
    { type: "message_stop" },
  ]);
  const result = parseAssistantSSE("conv-1", sse);
  assert.equal(result!.turn.content, "block0block1");
});

test("parseAssistantSSE ignores non-text content blocks", () => {
  const sse = makeSse([
    {
      type: "message_start",
      message: { id: "m2", role: "assistant", model: "claude-3" },
    },
    {
      type: "content_block_start",
      index: 0,
      content_block: { type: "tool_use", id: "tu1" },
    },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "answer" } },
    { type: "content_block_stop", index: 1 },
    { type: "message_stop" },
  ]);
  const result = parseAssistantSSE("conv-1", sse);
  assert.equal(result!.turn.content, "answer");
});

test("parseAssistantSSE returns null on empty response", () => {
  const result = parseAssistantSSE("conv-1", "");
  assert.equal(result, null);
});

test("parseAssistantSSE is resilient to malformed JSON lines", () => {
  const sse =
    "data: not-json\n\n" +
    makeSse([
      {
        type: "message_start",
        message: { id: "m3", role: "assistant", model: "claude-3" },
      },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } },
      { type: "message_stop" },
    ]);
  const result = parseAssistantSSE("conv-1", sse);
  assert.equal(result!.turn.content, "ok");
});
