/**
 * Page-world hook for gemini.google.com.
 *
 * TWO capture strategies run in parallel:
 *
 *  1. Fetch hook — intercepts POST requests to known Gemini API endpoints.
 *     Best for response metadata (model version, timestamps). May fail if
 *     Gemini changes its internal API shape.
 *
 *  2. DOM observer — watches for <user-query> and <model-response> custom
 *     elements. Less metadata, but more robust across Gemini UI changes.
 *
 * The hook de-duplicates: if the fetch parser successfully captures a turn,
 * the DOM observer skips emitting the same assistant turn.
 *
 * Conversation ID: derived from the page URL (/app/{id}) on load and on
 * every navigation event (Gemini is a SPA).
 */

import {
  isGeminiApiUrl,
  extractConversationIdFromUrl,
  parseGeminiResponse,
  GeminiDOMObserver,
} from "../adapters/gemini/index.js";
import { OPENMEM_EVENT_KEY } from "../lib/messaging.js";
import type { CapturedTurnEvent, PageHookEvent } from "../lib/messaging.js";

function emit(event: PageHookEvent): void {
  window.dispatchEvent(new CustomEvent(OPENMEM_EVENT_KEY, { detail: event }));
}

// ── Conversation ID tracking (SPA navigation) ────────────────────────────────

let currentConversationId: string = extractConversationIdFromUrl(location.href) ?? "gemini-unknown";

function refreshConvId(): void {
  const id = extractConversationIdFromUrl(location.href);
  if (id && id !== currentConversationId) {
    currentConversationId = id;
    // Re-start DOM observer for the new conversation
    domObserver?.stop();
    startDOMObserver();
  }
}

// Catch SPA navigation via history API
const _pushState = history.pushState.bind(history);
history.pushState = function (...args) {
  _pushState(...args);
  refreshConvId();
};
window.addEventListener("popstate", refreshConvId);

// ── Fetch hook ────────────────────────────────────────────────────────────────

// Track conversation IDs for which the fetch hook successfully emitted an
// assistant turn, so the DOM observer can skip them.
const fetchCapturedConvIds = new Set<string>();

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

  if (!isGeminiApiUrl(url)) {
    return _originalFetch(input, init);
  }

  const requestedAt = new Date().toISOString();
  const convId =
    extractConversationIdFromUrl(url) ??
    extractConversationIdFromUrl(location.href) ??
    "gemini-unknown";

  // Snapshot request body to try to extract user message
  let userContent: string | null = null;
  try {
    const raw = init?.body;
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Look for common user message fields
      if (typeof parsed.query === "string") userContent = parsed.query;
      else if (typeof parsed.prompt === "string") userContent = parsed.prompt;
    }
  } catch {
    // skip
  }

  const response = await _originalFetch(input, init);

  if (!response.body) return response;

  const [pageStream, captureStream] = response.body.tee();

  void (async () => {
    try {
      const chunks: Uint8Array[] = [];
      const reader = captureStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const body = chunks.map((c) => new TextDecoder().decode(c)).join("");
      const result = parseGeminiResponse(body, convId, requestedAt, body);

      if (result) {
        fetchCapturedConvIds.add(convId);
        if (userContent) {
          const userTurn: CapturedTurnEvent = {
            type: "OPENMEM_CAPTURED_TURN",
            provider: "gemini",
            providerConversationId: convId,
            role: "user",
            content: userContent,
            createdAt: requestedAt,
          };
          emit(userTurn);
        }
        emit(result.turn);
      }
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

// ── DOM observer (runs in parallel, skips if fetch already captured) ──────────

let domObserver: GeminiDOMObserver | null = null;

function startDOMObserver(): void {
  domObserver = new GeminiDOMObserver(currentConversationId, (turn) => {
    // Skip if the fetch hook already captured this conversation's assistant turn
    if (turn.role === "assistant" && fetchCapturedConvIds.has(currentConversationId)) {
      return;
    }
    emit(turn);
  });
  domObserver.start();
}

// Start on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startDOMObserver);
} else {
  startDOMObserver();
}
