/**
 * Google Takeout — Gemini Apps Activity parser.
 *
 * Source: myaccount.google.com → Data & Privacy → Download your data →
 *         Select "Gemini Apps Activity" → Export.
 *
 * The resulting ZIP typically contains:
 *   Takeout/Gemini Apps Activity/Gemini Apps Activity.json
 *
 * ⚠️  Google Takeout for Gemini (as of 2024-25) does NOT guarantee full
 * conversation transcripts. The export may contain only prompt activity
 * (user messages without model responses). We import whatever is available
 * and report the coverage clearly.
 *
 * We attempt to parse three known shapes, in order:
 *
 *  Shape A — Conversation transcript (if Google starts exporting full convs):
 *    { conversations: [{ id, title, createTime, turns: [{ role, text }] }] }
 *
 *  Shape B — Activity log with prompts:
 *    [{ title, activitySegments: [{ textContentSegment: { contentValue } }] }]
 *    Each entry becomes a single-turn "user" conversation.
 *
 *  Shape C — Array of objects with a "text" or "prompt" field (generic):
 *    Fallback best-effort extraction.
 */

import type { IngestTurn } from "@openmem/shared";
import { parseJSON } from "./utils.js";

// ── Shape A ───────────────────────────────────────────────────────────────────

interface TakeoutTurn {
  role: "user" | "model" | string;
  text?: string;
  content?: string;
}

interface TakeoutConversation {
  id?: string;
  conversationId?: string;
  title?: string;
  createTime?: string;
  create_time?: string;
  turns?: TakeoutTurn[];
  messages?: TakeoutTurn[];
}

interface ShapeA {
  conversations: TakeoutConversation[];
}

// ── Shape B (activity log) ─────────────────────────────────────────────────────

interface TextContentSegment {
  contentValue?: string;
}

interface ActivitySegment {
  textContentSegment?: TextContentSegment;
  text?: string;
}

interface ActivityEntry {
  title?: string;
  time?: string;
  activitySegments?: ActivitySegment[];
  details?: { activitySegments?: ActivitySegment[] };
  // Bard/older format
  snippet?: string;
  query?: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a single JSON file from a Google Takeout Gemini export.
 * Tries each known shape and falls through gracefully.
 */
export function* parseGeminiTakeout(json: string): Generator<IngestTurn> {
  const parsed = parseJSON<unknown>(json, "Gemini Apps Activity.json");

  // Shape A: full conversation transcripts
  if (isShapeA(parsed)) {
    yield* parseShapeA(parsed);
    return;
  }

  // Shape B: array of activity entries
  if (Array.isArray(parsed)) {
    yield* parseActivityArray(parsed as ActivityEntry[]);
    return;
  }

  // Shape C: top-level object wrapping an array under various keys
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["items", "activities", "data", "entries"]) {
      if (Array.isArray(obj[key])) {
        yield* parseActivityArray(obj[key] as ActivityEntry[]);
        return;
      }
    }
  }

  throw new Error(
    "Unrecognised Gemini Takeout format. " +
      "Please open an issue at github.com/openmem/openmem with a redacted sample.",
  );
}

// ── Shape A parser ─────────────────────────────────────────────────────────────

function isShapeA(v: unknown): v is ShapeA {
  return (
    Boolean(v) &&
    typeof v === "object" &&
    Array.isArray((v as ShapeA).conversations)
  );
}

function* parseShapeA(data: ShapeA): Generator<IngestTurn> {
  for (const conv of data.conversations) {
    const convId =
      conv.id ?? conv.conversationId ?? crypto.randomUUID();
    const createdAt =
      conv.createTime ?? conv.create_time ?? new Date().toISOString();
    const turns = conv.turns ?? conv.messages ?? [];

    for (const turn of turns) {
      const role = normaliseRole(turn.role);
      if (!role) continue;
      const content = (turn.text ?? turn.content ?? "").trim();
      if (!content) continue;

      yield {
        provider: "gemini",
        providerConversationId: convId,
        title: conv.title ?? undefined,
        role,
        content,
        contentFormat: "markdown",
        createdAt,
        source: "import",
      };
    }
  }
}

// ── Shape B / activity-log parser ─────────────────────────────────────────────

function* parseActivityArray(entries: ActivityEntry[]): Generator<IngestTurn> {
  for (const entry of entries) {
    const convId = crypto.randomUUID();
    const createdAt = entry.time ?? new Date().toISOString();

    // Try multiple places where the prompt text might be
    const text = extractActivityText(entry);
    if (!text) continue;

    // We only have the user prompt — import as a user-only turn and note the
    // limitation so the UI can show "responses not available in this export".
    yield {
      provider: "gemini",
      providerConversationId: convId,
      title: entry.title ?? undefined,
      role: "user",
      content: text,
      contentFormat: "markdown",
      createdAt,
      source: "import",
    };
  }
}

function extractActivityText(entry: ActivityEntry): string | null {
  // Direct fields
  if (entry.snippet) return entry.snippet.trim();
  if (entry.query) return entry.query.trim();

  // activitySegments at top level or inside details
  const segments =
    entry.activitySegments ??
    entry.details?.activitySegments ??
    [];

  for (const seg of segments) {
    const text =
      seg.textContentSegment?.contentValue ??
      seg.text;
    if (text?.trim()) return text.trim();
  }

  return null;
}

function normaliseRole(r: string): "user" | "assistant" | null {
  if (r === "user" || r === "human") return "user";
  if (r === "model" || r === "assistant") return "assistant";
  return null;
}
