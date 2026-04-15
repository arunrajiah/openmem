import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isChatGPTConversationUrl,
  parseUserTurn,
  parseAssistantSSE,
  resolveUserTurnConvId,
} from "./parser.js";

test("isChatGPTConversationUrl matches conversation endpoint", () => {
  assert.equal(
    isChatGPTConversationUrl("https://chatgpt.com/backend-api/conversation"),
    true,
  );
});

test("isChatGPTConversationUrl rejects other paths", () => {
  assert.equal(
    isChatGPTConversationUrl("https://chatgpt.com/backend-api/conversations/abc"),
    false,
  );
  assert.equal(
    isChatGPTConversationUrl("https://claude.ai/api/conversation"),
    false,
  );
});

test("parseUserTurn extracts last user message from parts array", () => {
  const req = {
    action: "next",
    messages: [
      {
        id: "m1",
        author: { role: "user" },
        content: { content_type: "text", parts: ["what is TypeScript?"] },
      },
    ],
    conversation_id: "conv-123",
    model: "gpt-4o",
  };
  const turn = parseUserTurn(req, "2024-01-01T00:00:00.000Z");
  assert.ok(turn);
  assert.equal(turn!.content, "what is TypeScript?");
  assert.equal(turn!.provider, "chatgpt");
  assert.equal(turn!.model, "gpt-4o");
  assert.equal(turn!.providerConversationId, "conv-123");
});

test("parseUserTurn uses __pending__ for new conversations without conv_id", () => {
  const req = {
    action: "next",
    messages: [
      {
        id: "m1",
        author: { role: "user" },
        content: { content_type: "text", parts: ["hello"] },
      },
    ],
    model: "gpt-4o",
  };
  const turn = parseUserTurn(req, "2024-01-01T00:00:00.000Z");
  assert.ok(turn);
  assert.equal(turn!.providerConversationId, "__pending__");
});

test("parseUserTurn filters out non-text parts (image objects)", () => {
  const req = {
    action: "next",
    messages: [
      {
        id: "m1",
        author: { role: "user" },
        content: {
          content_type: "multimodal_text",
          parts: [{ content_type: "image_asset_pointer", asset_pointer: "file-xxx" }, "describe this image"],
        },
      },
    ],
    model: "gpt-4o",
  };
  const turn = parseUserTurn(req, "2024-01-01T00:00:00.000Z");
  assert.ok(turn);
  assert.equal(turn!.content, "describe this image");
});

test("parseUserTurn returns null with no messages", () => {
  assert.equal(parseUserTurn({ action: "next" }, "2024-01-01T00:00:00.000Z"), null);
});

function makeSse(events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

const MSG_ID = "msg-abc";
const CONV_ID = "conv-xyz";

function makeConversationSSE(
  text: string,
  model = "gpt-4o",
  createTime = 1700000000,
) {
  return makeSse([
    {
      message: {
        id: MSG_ID,
        author: { role: "assistant" },
        content: { content_type: "text", parts: [text.slice(0, 5)] },
        status: "in_progress",
        metadata: { model_slug: model },
        create_time: createTime,
      },
      conversation_id: CONV_ID,
      error: null,
    },
    {
      message: {
        id: MSG_ID,
        author: { role: "assistant" },
        content: { content_type: "text", parts: [text] },
        status: "finished_successfully",
        metadata: { model_slug: model },
        create_time: createTime,
      },
      conversation_id: CONV_ID,
      error: null,
    },
  ]);
}

test("parseAssistantSSE reconstructs final message", () => {
  const result = parseAssistantSSE(makeConversationSSE("Hello, world!"));
  assert.ok(result);
  assert.equal(result!.turn.content, "Hello, world!");
  assert.equal(result!.turn.role, "assistant");
  assert.equal(result!.turn.model, "gpt-4o");
  assert.equal(result!.turn.providerMessageId, MSG_ID);
  assert.equal(result!.conversationId, CONV_ID);
});

test("parseAssistantSSE returns null when no finished message", () => {
  const sse = makeSse([
    {
      message: {
        id: "m1",
        author: { role: "assistant" },
        content: { content_type: "text", parts: ["partial"] },
        status: "in_progress",
        metadata: {},
      },
      conversation_id: CONV_ID,
      error: null,
    },
  ]);
  assert.equal(parseAssistantSSE(sse), null);
});

test("parseAssistantSSE skips tool/system messages", () => {
  const sse =
    makeSse([
      {
        message: {
          id: "tool-1",
          author: { role: "tool" },
          content: { content_type: "text", parts: ["tool output"] },
          status: "finished_successfully",
          metadata: {},
        },
        conversation_id: CONV_ID,
        error: null,
      },
    ]) + makeConversationSSE("Real answer");
  const result = parseAssistantSSE(sse);
  assert.ok(result);
  assert.equal(result!.turn.content, "Real answer");
});

test("resolveUserTurnConvId replaces __pending__", () => {
  const turn = parseUserTurn(
    { action: "next", messages: [{ id: "m1", author: { role: "user" }, content: { content_type: "text", parts: ["hi"] } }], model: "gpt-4o" },
    "2024-01-01T00:00:00.000Z",
  )!;
  const resolved = resolveUserTurnConvId(turn, "real-conv-id");
  assert.equal(resolved.providerConversationId, "real-conv-id");
  assert.equal(turn.providerConversationId, "__pending__"); // original unchanged
});
