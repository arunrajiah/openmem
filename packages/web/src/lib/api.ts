import type { Conversation, Message } from "@openmem/shared";

const BASE = "";  // served from the same origin in prod; proxy in dev

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

// ── Conversations ────────────────────────────────────────────────────────────

export interface ListConversationsOpts {
  provider?: string | undefined;
  tag?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export async function listConversations(
  opts: ListConversationsOpts = {},
): Promise<{ conversations: Conversation[] }> {
  const p = new URLSearchParams();
  if (opts.provider) p.set("provider", opts.provider);
  if (opts.tag) p.set("tag", opts.tag);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  return get(`/conversations?${p}`);
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  return get(`/conversations/${id}`);
}

// ── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  messageId: string;
  conversationId: string;
  conversationTitle: string | null;
  provider: string;
  model: string | null;
  role: string;
  snippet: string;
  createdAt: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

export interface SearchOpts {
  q: string;
  provider?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export async function searchMessages(opts: SearchOpts): Promise<SearchResponse> {
  const p = new URLSearchParams({ q: opts.q });
  if (opts.provider) p.set("provider", opts.provider);
  if (opts.from) p.set("from", opts.from);
  if (opts.to) p.set("to", opts.to);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  return get(`/search?${p}`);
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export interface TagCount {
  tag: string;
  count: number;
}

export async function listTags(): Promise<{ tags: TagCount[] }> {
  return get("/tags");
}

export async function setTags(
  conversationId: string,
  tags: string[],
): Promise<void> {
  const res = await fetch(`/conversations/${conversationId}/tags`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) throw new Error(`setTags failed: ${res.status}`);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface DbStats {
  conversations: number;
  messages: number;
  byProvider: Record<string, number>;
  dbSizeBytes: number;
  oldestConversation: string | null;
  newestConversation: string | null;
}

export async function getStats(): Promise<DbStats> {
  return get("/stats");
}

// ── Markdown export (client-side) ────────────────────────────────────────────

export function conversationToMarkdown(detail: ConversationDetail): string {
  const { conversation: conv, messages } = detail;
  const title = conv.title ?? "Untitled conversation";
  const lines: string[] = [
    `# ${title}`,
    "",
    `**Provider:** ${conv.provider}  `,
    `**Model:** ${conv.model ?? "unknown"}  `,
    `**Date:** ${new Date(conv.createdAt).toLocaleString()}  `,
    "",
    "---",
    "",
  ];
  for (const msg of messages) {
    const label = msg.role === "user" ? "**You**" : `**${conv.model ?? "Assistant"}**`;
    lines.push(`### ${label}`);
    lines.push("");
    lines.push(msg.content);
    lines.push("");
  }
  return lines.join("\n");
}
