/**
 * Page-world script for claude.ai.
 * Runs with world: "MAIN" — has access to the page's fetch/XHR but NO chrome.* APIs.
 *
 * Strategy:
 *   1. Patch window.fetch before any page scripts run (document_start).
 *   2. On a completion request:
 *      a. Snapshot the request body to extract the user turn.
 *      b. Tee the response stream; let the page consume one copy unmodified.
 *      c. Read the other copy to accumulate SSE events.
 *      d. On stream end, fire CustomEvents picked up by the ISOLATED content script.
 */

import {
  isClaudeCompletionUrl,
  extractConversationId,
  parseUserTurn,
  parseAssistantSSE,
} from "../adapters/claude/index.js";
import type { ClaudeCompletionRequest } from "../adapters/claude/types.js";
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

  if (!isClaudeCompletionUrl(url)) {
    return _originalFetch(input, init);
  }

  const convId = extractConversationId(url);
  if (!convId) return _originalFetch(input, init);

  const requestedAt = new Date().toISOString();

  // --- Snapshot request body (usually a JSON string) ---
  let requestBody: Record<string, unknown> | null = null;
  try {
    const rawBody = init?.body;
    if (typeof rawBody === "string") {
      requestBody = JSON.parse(rawBody) as Record<string, unknown>;
    } else if (rawBody instanceof URLSearchParams) {
      requestBody = Object.fromEntries(rawBody.entries());
    }
    // ReadableStream or Blob bodies: skip — too complex, user message may appear in DOM anyway
  } catch {
    // non-JSON body — skip
  }

  // --- Fire the request ---
  const response = await _originalFetch(input, init);

  if (!response.body || !response.ok) {
    return response;
  }

  // --- Tee the response stream ---
  const [pageStream, captureStream] = response.body.tee();

  // Process capture stream in background — do not block the page
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

      // Emit user turn
      if (requestBody) {
        const userTurn = parseUserTurn(convId, requestBody as ClaudeCompletionRequest, requestedAt);
        if (userTurn) emit(userTurn);
      }

      // Emit assistant turn
      const parsed = parseAssistantSSE(convId, sseText);
      if (parsed) emit(parsed.turn);
    } catch (err) {
      emit({
        type: "OPENMEM_CAPTURE_ERROR",
        message: String(err),
      });
    }
  })();

  return new Response(pageStream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
