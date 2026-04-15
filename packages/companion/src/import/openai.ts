/**
 * OpenAI data-export parser.
 *
 * Source: Settings → Data controls → Export data → conversations.json
 *
 * Format:
 *   Array of conversation objects, each with a `mapping` tree of nodes.
 *   Nodes are linked by `parent` / `children` pointers; the conversation
 *   object's `current_node` points to the leaf of the active branch.
 *
 * Strategy: walk from `current_node` back to the root via `parent` pointers,
 * then reverse to get chronological order. This correctly handles branching
 * (edit/regenerate) by following the branch that was current at export time.
 */

import type { IngestTurn } from "@openmem/shared";
import { parseJSON } from "./utils.js";

// ── Raw types ─────────────────────────────────────────────────────────────────

interface OAIContentPart {
  content_type?: string;
  text?: string;
  // images, code, tool outputs, etc. have other shapes — we skip them
}

interface OAIContent {
  content_type: string;
  parts?: Array<string | OAIContentPart | null>;
  text?: string; // some content types use this directly
}

interface OAIMessageMeta {
  model_slug?: string | null;
  finish_details?: { type: string } | null;
}

interface OAIMessage {
  id: string;
  author: { role: "user" | "assistant" | "system" | "tool" | string };
  create_time: number | null;
  content: OAIContent;
  status: string;
  metadata: OAIMessageMeta;
}

interface OAINode {
  id: string;
  message: OAIMessage | null;
  parent: string | null;
  children: string[];
}

interface OAIConversation {
  id: string;
  title: string | null;
  create_time: number;
  update_time: number;
  current_node: string | null;
  mapping: Record<string, OAINode>;
}

// ── Text extraction ───────────────────────────────────────────────────────────

function extractText(content: OAIContent): string | null {
  if (content.content_type === "text") {
    if (typeof content.text === "string" && content.text.trim()) {
      return content.text.trim();
    }
    if (Array.isArray(content.parts)) {
      const text = content.parts
        .filter((p): p is string => typeof p === "string")
        .join("")
        .trim();
      if (text) return text;
    }
  }
  // Other types (tether_browsing, code, multimodal_text, etc.) — skip for now
  return null;
}

// ── Conversation reconstruction ───────────────────────────────────────────────

/**
 * Walk from current_node back to root, collecting messages in reverse order,
 * then return them chronologically.
 */
function reconstructChain(conv: OAIConversation): OAIMessage[] {
  const { mapping } = conv;

  // Prefer current_node; otherwise find the deepest leaf (last child recursively)
  let nodeId: string | null =
    conv.current_node ??
    findDeepestLeaf(mapping, findRoot(mapping));

  const chain: OAIMessage[] = [];
  const visited = new Set<string>();

  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node = mapping[nodeId];
    if (!node) break;
    if (node.message) chain.push(node.message);
    nodeId = node.parent;
  }

  return chain.reverse();
}

function findRoot(mapping: Record<string, OAINode>): string | null {
  return (
    Object.values(mapping).find(
      (n) => n.parent === null || !mapping[n.parent ?? ""],
    )?.id ?? null
  );
}

function findDeepestLeaf(
  mapping: Record<string, OAINode>,
  nodeId: string | null,
): string | null {
  if (!nodeId) return null;
  const node = mapping[nodeId];
  if (!node || node.children.length === 0) return nodeId;
  // Follow last child (most recent branch)
  const last = node.children.at(-1) ?? null;
  return findDeepestLeaf(mapping, last);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse conversations.json from an OpenAI data export and yield IngestTurn
 * objects, one per message per conversation.
 */
export function* parseOpenAIExport(json: string): Generator<IngestTurn> {
  const conversations = parseJSON<OAIConversation[]>(json, "conversations.json");
  if (!Array.isArray(conversations)) {
    throw new Error("conversations.json is not an array");
  }

  for (const conv of conversations) {
    if (!conv?.id || typeof conv.mapping !== "object") continue;

    const messages = reconstructChain(conv);

    // Determine model: first non-null model_slug from assistant messages
    const model =
      messages
        .find((m) => m.author.role === "assistant" && m.metadata?.model_slug)
        ?.metadata?.model_slug ?? null;

    const createdAt = conv.create_time
      ? new Date(conv.create_time * 1000).toISOString()
      : new Date().toISOString();

    for (const msg of messages) {
      const role = msg.author.role;
      if (role !== "user" && role !== "assistant") continue; // skip system/tool

      const content = extractText(msg.content);
      if (!content) continue;

      const msgCreatedAt = msg.create_time
        ? new Date(msg.create_time * 1000).toISOString()
        : createdAt;

      const turn: IngestTurn = {
        provider: "chatgpt",
        providerConversationId: conv.id,
        providerMessageId: msg.id,
        title: conv.title ?? undefined,
        model: model ?? undefined,
        role: role as "user" | "assistant",
        content,
        contentFormat: "markdown",
        createdAt: msgCreatedAt,
        source: "import",
      };

      yield turn;
    }
  }
}
