/**
 * Parses captured data from claude.ai's completion endpoint into
 * CapturedTurnEvent objects (one user turn + one assistant turn per completion).
 *
 * URL pattern:  POST https://claude.ai/api/organizations/{orgId}/chat_conversations/{convId}/completion
 * Response:     SSE stream following the Anthropic Messages API event format
 */

import { parseSSEString } from "../../lib/sse.js";
import type { CapturedTurnEvent } from "../../lib/messaging.js";
import type {
  ClaudeCompletionRequest,
  ClaudeSSEEvent,
  ContentBlockDeltaEvent,
  ContentBlockStartEvent,
  MessageStartEvent,
} from "./types.js";

const COMPLETION_PATTERN =
  /\/api\/organizations\/[^/]+\/chat_conversations\/([^/]+)\/completion/;

export function isClaudeCompletionUrl(url: string): boolean {
  return COMPLETION_PATTERN.test(url);
}

export function extractConversationId(url: string): string | null {
  return COMPLETION_PATTERN.exec(url)?.[1] ?? null;
}

/**
 * Parse the user turn from a completion request body.
 * Returns null if no user message can be extracted.
 */
export function parseUserTurn(
  convId: string,
  request: ClaudeCompletionRequest,
  requestedAt: string,
): CapturedTurnEvent | null {
  let content: string | null = null;

  if (Array.isArray(request.messages)) {
    // Newer format: messages array — take the last user message
    const userMsgs = request.messages.filter((m) => m.role === "user");
    const last = userMsgs.at(-1);
    if (last) {
      if (typeof last.content === "string") {
        content = last.content;
      } else if (Array.isArray(last.content)) {
        // Content may be an array of {type:"text", text:"..."} blocks
        content = last.content
          .filter((b): b is { type: string; text: string } => typeof (b as any).text === "string")
          .map((b) => b.text)
          .join("\n");
      }
    }
  } else if (typeof request.prompt === "string") {
    // Legacy prompt format: "\n\nHuman: <msg>\n\nAssistant:"
    const match = /\n\nHuman:\s*([\s\S]+?)(?:\n\nAssistant:|$)/.exec(
      request.prompt,
    );
    if (match?.[1]) content = match[1].trim();
  }

  if (!content) return null;

  return {
    type: "OPENMEM_CAPTURED_TURN",
    provider: "claude",
    providerConversationId: convId,
    role: "user",
    content,
    model: request.model,
    createdAt: requestedAt,
    rawPayload: request,
  };
}

export interface ParsedAssistantTurn {
  turn: CapturedTurnEvent;
  /** Raw SSE events, for the rawPayload field */
  events: unknown[];
}

/**
 * Parse a full SSE response body string into an assistant turn.
 * Suitable for unit tests (takes string, not stream).
 */
export function parseAssistantSSE(
  convId: string,
  sseText: string,
): ParsedAssistantTurn | null {
  let messageId: string | undefined;
  let model: string | undefined;
  let outputTokens: number | undefined;
  const textBlocks: Map<number, string> = new Map();
  const events: unknown[] = [];

  for (const raw of parseSSEString(sseText)) {
    events.push(raw);
    const ev = raw as ClaudeSSEEvent;

    if (ev.type === "message_start") {
      const mse = ev as MessageStartEvent;
      messageId = mse.message.id;
      model = mse.message.model;
      if (mse.message.usage?.output_tokens) {
        outputTokens = mse.message.usage.output_tokens;
      }
    } else if (ev.type === "content_block_start") {
      const cbs = ev as ContentBlockStartEvent;
      if (cbs.content_block.type === "text") {
        textBlocks.set(cbs.index, cbs.content_block.text ?? "");
      }
    } else if (ev.type === "content_block_delta") {
      const cbd = ev as ContentBlockDeltaEvent;
      if (cbd.delta.type === "text_delta" && cbd.delta.text !== undefined) {
        textBlocks.set(
          cbd.index,
          (textBlocks.get(cbd.index) ?? "") + cbd.delta.text,
        );
      }
    } else if (ev.type === "message_delta") {
      if ((ev as any).usage?.output_tokens) {
        outputTokens = (ev as any).usage.output_tokens;
      }
    }
  }

  const content = [...textBlocks.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, t]) => t)
    .join("")
    .trim();

  if (!content) return null;

  return {
    turn: {
      type: "OPENMEM_CAPTURED_TURN",
      provider: "claude",
      providerConversationId: convId,
      providerMessageId: messageId,
      model,
      role: "assistant",
      content,
      tokensEstimate: outputTokens,
      rawPayload: events,
    },
    events,
  };
}
