/**
 * Typed message protocol between the three worlds:
 *   page (MAIN) ──postMessage──▶ content (ISOLATED) ──sendMessage──▶ background SW
 *
 * All events from page world use the OPENMEM_EVENT_KEY prefix to avoid
 * collisions with the page's own message bus.
 */

export const OPENMEM_EVENT_KEY = "__openmem__";

/** Fired by the page-world hook for each completed turn */
export interface CapturedTurnEvent {
  type: "OPENMEM_CAPTURED_TURN";
  provider: string;
  providerConversationId: string;
  providerMessageId?: string;
  title?: string;
  model?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  tokensEstimate?: number;
  rawPayload?: unknown;
}

/** Fired by the page-world hook to surface non-fatal parse errors */
export interface CaptureErrorEvent {
  type: "OPENMEM_CAPTURE_ERROR";
  message: string;
}

export type PageHookEvent = CapturedTurnEvent | CaptureErrorEvent;

/**
 * Message sent from content script to background SW via chrome.runtime.sendMessage
 */
export interface RuntimeIngestMessage {
  type: "INGEST_TURN";
  payload: CapturedTurnEvent;
}

export type RuntimeMessage = RuntimeIngestMessage;
