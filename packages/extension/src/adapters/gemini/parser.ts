/**
 * Parser for gemini.google.com's internal API response format.
 *
 * Gemini returns a custom streaming format prefixed with the XSSI guard
 *   )]}'\n
 * followed by newline-delimited JSON chunks.  Each chunk is a JSON array
 * whose structure nests candidate text.
 *
 * We try three levels of parsing (most to least structured):
 *   1. Google Generative AI / Vertex-style candidates array
 *   2. Bard/Gemini legacy nested array
 *   3. Concatenate any strings found via depth-first scan (last resort)
 *
 * Importantly, all parsing happens on the *fully accumulated* response body —
 * we do not try to parse intermediate streaming chunks.
 */

import type { CapturedTurnEvent } from "../../lib/messaging.js";

const GEMINI_URL_PATTERNS = [
  /gemini\.google\.com\/api\/generate/,
  /gemini\.google\.com\/_\/BardChatUi\/data\//,
];

export function isGeminiApiUrl(url: string): boolean {
  return GEMINI_URL_PATTERNS.some((p) => p.test(url));
}

/** Strip XSSI prefix and return cleaned JSON text */
function stripXSSI(body: string): string {
  return body.replace(/^\)]\}'\s*\n?/, "").trim();
}

/**
 * Attempt to extract text from a parsed Gemini JSON payload.
 * Tries multiple known shapes; returns empty string if none match.
 */
function extractText(parsed: unknown): string {
  // Shape 1: { candidates: [{ content: { parts: [{ text }] } }] }
  // (matches Vertex / Generative Language API style)
  type GeminiCandidate = { content?: { parts?: Array<{ text?: string }> } };
  const withCandidates = parsed as { candidates?: GeminiCandidate[] };
  if (Array.isArray(withCandidates?.candidates)) {
    const parts: string[] = [];
    for (const c of withCandidates.candidates) {
      if (Array.isArray(c?.content?.parts)) {
        for (const p of c.content.parts) {
          if (typeof p?.text === "string") parts.push(p.text);
        }
      }
    }
    if (parts.length) return parts.join("");
  }

  // Shape 2: outer array [[[ [candidateText, ...], ...], ...], ...]
  // Gemini/Bard nested array format — drill into nested arrays looking for
  // a string that looks like the response text.
  if (Array.isArray(parsed)) {
    const texts = collectStrings(parsed as unknown[], 0);
    if (texts.length) return texts.join("").trim();
  }

  return "";
}

/** Depth-first collect strings from nested arrays (up to depth 8) */
function collectStrings(arr: unknown[], depth: number): string[] {
  if (depth > 8) return [];
  const results: string[] = [];
  for (const item of arr) {
    if (typeof item === "string" && item.trim().length > 0) {
      results.push(item);
    } else if (Array.isArray(item)) {
      results.push(...collectStrings(item, depth + 1));
    }
  }
  return results;
}

/**
 * Parse conversation ID from URL or query params.
 * Gemini URLs look like: /app/{conversationId}
 */
export function extractConversationIdFromUrl(url: string): string | null {
  const appMatch = /\/app\/([a-zA-Z0-9_-]{10,})/.exec(url);
  if (appMatch) return appMatch[1] ?? null;
  const paramMatch = /[?&]c=([^&]+)/.exec(url);
  if (paramMatch) return paramMatch[1] ?? null;
  return null;
}

export interface ParsedGeminiResponse {
  turn: CapturedTurnEvent;
}

/**
 * Parse a raw Gemini API response body into an assistant CapturedTurnEvent.
 * Returns null if the body can't be parsed into usable text.
 */
export function parseGeminiResponse(
  body: string,
  conversationId: string,
  requestedAt: string,
  rawPayload?: unknown,
): ParsedGeminiResponse | null {
  const cleaned = stripXSSI(body);
  if (!cleaned) return null;

  // Response may be a single JSON value or newline-delimited JSON chunks.
  // Accumulate text across all chunks.
  let accText = "";
  const lines = cleaned.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const t = extractText(parsed);
      if (t) accText += t;
    } catch {
      // Non-JSON line — skip (could be size prefix or whitespace)
    }
  }

  // If line-by-line failed, try the whole body as one JSON blob
  if (!accText) {
    try {
      const parsed = JSON.parse(cleaned);
      accText = extractText(parsed);
    } catch {
      // truly unparseable — surface via rawPayload but don't fail
    }
  }

  if (!accText) return null;

  return {
    turn: {
      type: "OPENMEM_CAPTURED_TURN",
      provider: "gemini",
      providerConversationId: conversationId,
      role: "assistant",
      content: accText.trim(),
      createdAt: requestedAt,
      rawPayload,
    },
  };
}
