/**
 * Parser for chatgpt.com's completion API.
 *
 * URL:  POST https://chatgpt.com/backend-api/conversation
 *
 * The request body carries the user message. The SSE response sends the
 * assistant message incrementally — each event carries the FULL accumulated
 * text so far. We take the last finished_successfully event.
 */

import { parseSSEString } from "../../lib/sse.js";
import type { CapturedTurnEvent } from "../../lib/messaging.js";
import type { ChatGPTRequest, ChatGPTSSEEvent } from "./types.js";

const CONVERSATION_URL = /chatgpt\.com\/backend-api\/conversation$/;

export function isChatGPTConversationUrl(url: string): boolean {
  return CONVERSATION_URL.test(url);
}

/** Extract plain text from ChatGPT content parts (filters out image/file objects). */
function extractPartsText(
  parts: Array<string | Record<string, unknown>> | undefined,
): string {
  if (!parts) return "";
  return parts
    .filter((p): p is string => typeof p === "string")
    .join("\n")
    .trim();
}

export function parseUserTurn(
  request: ChatGPTRequest,
  requestedAt: string,
): CapturedTurnEvent | null {
  const userMsgs = (request.messages ?? []).filter(
    (m) => m.author?.role === "user",
  );
  const last = userMsgs.at(-1);
  if (!last) return null;

  const content = extractPartsText(
    last.content?.parts as Array<string | Record<string, unknown>> | undefined,
  );
  if (!content) return null;

  return {
    type: "OPENMEM_CAPTURED_TURN",
    provider: "chatgpt",
    // We may not know the conversation ID yet for a new conversation;
    // it will be filled in from the SSE stream. Use a placeholder here
    // and update via the assistant turn which always has the real ID.
    providerConversationId: request.conversation_id ?? "__pending__",
    role: "user",
    content,
    model: request.model,
    createdAt: requestedAt,
    rawPayload: request,
  };
}

export interface ParsedAssistantSSE {
  turn: CapturedTurnEvent;
  conversationId: string;
}

/**
 * Parse the SSE text from a conversation response.
 * Returns the last completed assistant message + the conversation ID.
 */
export function parseAssistantSSE(sseText: string): ParsedAssistantSSE | null {
  let lastFinished: ChatGPTSSEEvent | null = null;

  for (const raw of parseSSEString(sseText)) {
    const ev = raw as ChatGPTSSEEvent;
    if (
      ev?.message?.author?.role === "assistant" &&
      ev.message.status === "finished_successfully"
    ) {
      lastFinished = ev;
    }
  }

  if (!lastFinished) return null;

  const content = extractPartsText(
    lastFinished.message.content?.parts as
      | Array<string | Record<string, unknown>>
      | undefined,
  );
  if (!content) return null;

  return {
    conversationId: lastFinished.conversation_id,
    turn: {
      type: "OPENMEM_CAPTURED_TURN",
      provider: "chatgpt",
      providerConversationId: lastFinished.conversation_id,
      providerMessageId: lastFinished.message.id,
      role: "assistant",
      content,
      model: lastFinished.message.metadata?.model_slug,
      createdAt: lastFinished.message.create_time
        ? new Date(lastFinished.message.create_time * 1000).toISOString()
        : undefined,
      rawPayload: lastFinished,
    },
  };
}

/**
 * Patch up a pending user turn with the real conversation ID once we know it.
 * Returns a new event object, does not mutate.
 */
export function resolveUserTurnConvId(
  userTurn: CapturedTurnEvent,
  conversationId: string,
): CapturedTurnEvent {
  return { ...userTurn, providerConversationId: conversationId };
}
