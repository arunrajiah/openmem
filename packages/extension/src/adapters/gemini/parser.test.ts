import { test } from "node:test";
import assert from "node:assert/strict";
import { isGeminiApiUrl, extractConversationIdFromUrl, parseGeminiResponse } from "./parser.js";

test("isGeminiApiUrl matches api/generate", () => {
  assert.equal(
    isGeminiApiUrl("https://gemini.google.com/api/generate"),
    true,
  );
});

test("isGeminiApiUrl matches BardChatUi data endpoints", () => {
  assert.equal(
    isGeminiApiUrl(
      "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate",
    ),
    true,
  );
});

test("isGeminiApiUrl rejects unrelated URLs", () => {
  assert.equal(isGeminiApiUrl("https://google.com/search"), false);
  assert.equal(isGeminiApiUrl("https://claude.ai/chat"), false);
});

test("extractConversationIdFromUrl parses /app/{id} path", () => {
  assert.equal(
    extractConversationIdFromUrl("https://gemini.google.com/app/abc123def456"),
    "abc123def456",
  );
});

test("extractConversationIdFromUrl parses ?c= query param", () => {
  assert.equal(
    extractConversationIdFromUrl("https://gemini.google.com/api/generate?c=myConvId"),
    "myConvId",
  );
});

test("extractConversationIdFromUrl returns null for unknown patterns", () => {
  assert.equal(
    extractConversationIdFromUrl("https://gemini.google.com/api/generate"),
    null,
  );
});

// ── Response parsing ──────────────────────────────────────────────────────────

test("parseGeminiResponse handles Vertex-style candidates format", () => {
  const body = JSON.stringify({
    candidates: [
      {
        content: {
          parts: [{ text: "Hello from Gemini!" }],
          role: "model",
        },
        finishReason: "STOP",
      },
    ],
  });
  const result = parseGeminiResponse(body, "conv-1", "2024-01-01T00:00:00.000Z");
  assert.ok(result);
  assert.equal(result!.turn.content, "Hello from Gemini!");
  assert.equal(result!.turn.provider, "gemini");
  assert.equal(result!.turn.role, "assistant");
});

test("parseGeminiResponse strips XSSI prefix", () => {
  const body =
    ")]}'\n" +
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Safe response" }], role: "model" } }],
    });
  const result = parseGeminiResponse(body, "conv-1", "2024-01-01T00:00:00.000Z");
  assert.ok(result);
  assert.equal(result!.turn.content, "Safe response");
});

test("parseGeminiResponse accumulates text across newline-delimited chunks", () => {
  const chunk1 = JSON.stringify({
    candidates: [{ content: { parts: [{ text: "Hello " }], role: "model" } }],
  });
  const chunk2 = JSON.stringify({
    candidates: [{ content: { parts: [{ text: "world!" }], role: "model" } }],
  });
  const result = parseGeminiResponse(
    chunk1 + "\n" + chunk2,
    "conv-1",
    "2024-01-01T00:00:00.000Z",
  );
  assert.ok(result);
  assert.equal(result!.turn.content, "Hello world!");
});

test("parseGeminiResponse returns null for empty/unparseable body", () => {
  assert.equal(parseGeminiResponse("", "c", "2024-01-01T00:00:00.000Z"), null);
  assert.equal(parseGeminiResponse(")]}'\n", "c", "2024-01-01T00:00:00.000Z"), null);
  assert.equal(
    parseGeminiResponse("not json at all", "c", "2024-01-01T00:00:00.000Z"),
    null,
  );
});

test("parseGeminiResponse uses conversation ID from argument", () => {
  const body = JSON.stringify({
    candidates: [{ content: { parts: [{ text: "hi" }], role: "model" } }],
  });
  const result = parseGeminiResponse(body, "my-conv-id", "2024-01-01T00:00:00.000Z");
  assert.equal(result!.turn.providerConversationId, "my-conv-id");
});
