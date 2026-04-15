/**
 * Content script for chatgpt.com (ISOLATED world).
 * Relays CustomEvents from the page-world hook to the background SW.
 */

import { OPENMEM_EVENT_KEY } from "../lib/messaging.js";
import type { PageHookEvent, RuntimeIngestMessage } from "../lib/messaging.js";

window.addEventListener(OPENMEM_EVENT_KEY, (raw) => {
  const event = (raw as CustomEvent<PageHookEvent>).detail;
  if (!event) return;

  if (event.type === "OPENMEM_CAPTURE_ERROR") {
    console.warn("[openmem/chatgpt] capture error:", event.message);
    return;
  }

  if (event.type === "OPENMEM_CAPTURED_TURN") {
    const msg: RuntimeIngestMessage = { type: "INGEST_TURN", payload: event };
    chrome.runtime.sendMessage(msg).catch((err) => {
      console.warn("[openmem/chatgpt] sendMessage failed:", err);
    });
  }
});
