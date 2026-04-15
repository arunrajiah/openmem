/**
 * HTTP client used by the background service worker to POST turns to the
 * companion app. Retries once on network failure; silently drops if companion
 * is not running (localhost may be unavailable).
 */

import type { IngestTurn } from "@openmem/shared";

const COMPANION_URL = "http://127.0.0.1:7410";

export async function postIngest(turn: IngestTurn): Promise<void> {
  const body = JSON.stringify(turn);
  const headers = { "content-type": "application/json" };

  try {
    const res = await fetch(`${COMPANION_URL}/ingest`, {
      method: "POST",
      headers,
      body,
    });
    if (!res.ok) {
      console.warn(
        `[openmem] companion returned ${res.status} for ingest`,
        await res.text().catch(() => ""),
      );
    }
  } catch (err) {
    // Companion not running — retry once after 2 s, then give up silently.
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await fetch(`${COMPANION_URL}/ingest`, { method: "POST", headers, body });
    } catch {
      // Companion unavailable; drop turn. TODO: queue to chrome.storage.local
    }
  }
}
