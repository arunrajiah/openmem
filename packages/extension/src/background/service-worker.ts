/**
 * MV3 background service worker.
 * Receives INGEST_TURN messages from content scripts and POSTs them to
 * the companion app at http://127.0.0.1:7410/ingest.
 */

import { postIngest } from "../lib/companion.js";
import type { RuntimeMessage, CapturedTurnEvent } from "../lib/messaging.js";
import type { IngestTurn } from "@openmem/shared";

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type !== "INGEST_TURN") return false;

    const ev = message.payload as CapturedTurnEvent;
    const turn: IngestTurn = {
      provider: ev.provider as IngestTurn["provider"],
      providerConversationId: ev.providerConversationId,
      providerMessageId: ev.providerMessageId,
      title: ev.title,
      model: ev.model,
      role: ev.role as IngestTurn["role"],
      content: ev.content,
      contentFormat: "markdown",
      createdAt: ev.createdAt,
      tokensEstimate: ev.tokensEstimate,
      source: "live_capture",
      rawPayload: ev.rawPayload,
    };

    postIngest(turn)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));

    // Return true to indicate async response
    return true;
  },
);

// Log on install/update for debugging
chrome.runtime.onInstalled.addListener(({ reason }) => {
  console.log(`[openmem] service worker installed (${reason})`);
});
