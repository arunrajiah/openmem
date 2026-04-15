/**
 * Page-world hook for chatgpt.com.
 *
 * Intercepts POST /backend-api/conversation, captures:
 *  - user message from request body
 *  - assistant message + conversation ID from SSE response
 *
 * Note on new conversations: the conversation ID is NOT in the URL or request
 * body when starting fresh — it only appears in SSE events. We emit the user
 * turn with providerConversationId="__pending__" and the caller is expected to
 * reconcile it using resolveUserTurnConvId once the assistant turn is parsed.
 */

import {
  isChatGPTConversationUrl,
  parseUserTurn,
  parseAssistantSSE,
  resolveUserTurnConvId,
} from "../adapters/chatgpt/index.js";
import type { ChatGPTRequest } from "../adapters/chatgpt/types.js";
import { OPENMEM_EVENT_KEY } from "../lib/messaging.js";
import type { PageHookEvent } from "../lib/messaging.js";

function emit(event: PageHookEvent): void {
  window.dispatchEvent(new CustomEvent(OPENMEM_EVENT_KEY, { detail: event }));
}

const _originalFetch = window.fetch.bind(window);

window.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

  if (!isChatGPTConversationUrl(url)) {
    return _originalFetch(input, init);
  }

  const requestedAt = new Date().toISOString();

  // Snapshot request body
  let requestBody: Record<string, unknown> | null = null;
  try {
    const raw = init?.body;
    if (typeof raw === "string") requestBody = JSON.parse(raw);
  } catch {
    // skip
  }

  const response = await _originalFetch(input, init);

  if (!response.body || !response.ok) return response;

  const [pageStream, captureStream] = response.body.tee();

  void (async () => {
    try {
      const chunks: Uint8Array[] = [];
      const reader = captureStream.getReader();
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const decoder = new TextDecoder();
      const sseText = chunks.map((c) => decoder.decode(c)).join("");

      const assistantResult = parseAssistantSSE(sseText);
      let userTurn = requestBody ? parseUserTurn(requestBody as ChatGPTRequest, requestedAt) : null;

      // Resolve pending conv ID from the assistant turn
      if (userTurn && assistantResult) {
        userTurn = resolveUserTurnConvId(userTurn, assistantResult.conversationId);
      }

      if (userTurn) emit(userTurn);
      if (assistantResult) emit(assistantResult.turn);
    } catch (err) {
      emit({ type: "OPENMEM_CAPTURE_ERROR", message: String(err) });
    }
  })();

  return new Response(pageStream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
