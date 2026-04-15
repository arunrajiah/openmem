/**
 * Content script for claude.ai.
 * Runs in ISOLATED world — has access to chrome.* but NOT to page JS.
 *
 * Listens for CustomEvents dispatched by the page-world hook, then
 * forwards them to the background service worker.
 */

import { OPENMEM_EVENT_KEY } from "../lib/messaging.js";
import type { PageHookEvent, RuntimeIngestMessage } from "../lib/messaging.js";

window.addEventListener(OPENMEM_EVENT_KEY, (raw) => {
  const event = (raw as CustomEvent<PageHookEvent>).detail;
  if (!event) return;

  if (event.type === "OPENMEM_CAPTURE_ERROR") {
    console.warn("[openmem] capture error:", event.message);
    return;
  }

  if (event.type === "OPENMEM_CAPTURED_TURN") {
    const msg: RuntimeIngestMessage = { type: "INGEST_TURN", payload: event };
    chrome.runtime.sendMessage(msg).catch((err) => {
      // Background SW may be sleeping; the message is dropped. A persistent
      // queue (chrome.storage.local) is a Phase 6 improvement.
      console.warn("[openmem] sendMessage failed:", err);
    });
  }
});
