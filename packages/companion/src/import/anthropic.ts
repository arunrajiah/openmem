/**
 * Anthropic data-export parser.
 *
 * Source: privacy.anthropic.com → Export Data → ZIP file
 *
 * The ZIP contains a single file: `conversations.json`
 *
 * Format:
 * [
 *   {
 *     "uuid": "...",
 *     "name": "Conversation title",
 *     "created_at": "2024-01-01T00:00:00.000000Z",
 *     "updated_at": "2024-01-01T00:00:00.000000Z",
 *     "chat_messages": [
 *       {
 *         "uuid": "...",
 *         "text": "message content",
 *         "sender": "human" | "assistant",
 *         "created_at": "...",
 *         "updated_at": "...",
 *         "attachments": [],
 *         "files": []
 *       }
 *     ]
 *   }
 * ]
 */

import type { IngestTurn } from "@openmem/shared";
import { parseJSON } from "./utils.js";

// ── Raw types ─────────────────────────────────────────────────────────────────

interface AnthropicAttachment {
  file_name?: string;
  file_type?: string;
  file_size?: number;
  extracted_content?: string;
}

interface AnthropicMessage {
  uuid: string;
  text: string;
  sender: "human" | "assistant" | string;
  created_at: string;
  updated_at?: string;
  attachments?: AnthropicAttachment[];
  files?: unknown[];
}

interface AnthropicConversation {
  uuid: string;
  name: string | null;
  created_at: string;
  updated_at?: string;
  account?: { uuid: string };
  chat_messages: AnthropicMessage[];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse conversations.json from an Anthropic data export and yield IngestTurn
 * objects.
 */
export function* parseAnthropicExport(json: string): Generator<IngestTurn> {
  const conversations = parseJSON<AnthropicConversation[]>(
    json,
    "conversations.json",
  );
  if (!Array.isArray(conversations)) {
    throw new Error("conversations.json is not an array");
  }

  for (const conv of conversations) {
    if (!conv?.uuid || !Array.isArray(conv.chat_messages)) continue;

    for (const msg of conv.chat_messages) {
      if (!msg?.uuid) continue;

      const role = senderToRole(msg.sender);
      if (!role) continue;

      const content = (msg.text ?? "").trim();
      if (!content) continue;

      // Build attachment metadata if any
      const attachments = (msg.attachments ?? [])
        .filter((a): a is AnthropicAttachment => Boolean(a?.file_name))
        .map((a) => ({
          kind: a.file_type?.startsWith("image/") ? "image" : "file",
          name: a.file_name,
          mime: a.file_type,
          bytes: a.file_size,
        }));

      const turn: IngestTurn = {
        provider: "claude",
        providerConversationId: conv.uuid,
        providerMessageId: msg.uuid,
        title: conv.name ?? undefined,
        role,
        content,
        contentFormat: "markdown",
        createdAt: msg.created_at,
        attachments: attachments.length ? attachments : undefined,
        source: "import",
      };

      yield turn;
    }
  }
}

function senderToRole(
  sender: string,
): "user" | "assistant" | null {
  if (sender === "human") return "user";
  if (sender === "assistant") return "assistant";
  return null;
}
