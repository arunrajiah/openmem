import { z } from "zod";

export const Provider = z.enum(["claude", "chatgpt", "gemini", "perplexity", "other"]);
export type Provider = z.infer<typeof Provider>;

export const Role = z.enum(["user", "assistant", "system", "tool"]);
export type Role = z.infer<typeof Role>;

export const ContentFormat = z.enum(["text", "markdown", "html"]);
export type ContentFormat = z.infer<typeof ContentFormat>;

export const Source = z.enum(["live_capture", "import", "api_proxy"]);
export type Source = z.infer<typeof Source>;

export const AttachmentMeta = z.object({
  kind: z.string(), // "image" | "file" | "audio" | ...
  name: z.string().optional(),
  mime: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
  url: z.string().optional(),
});
export type AttachmentMeta = z.infer<typeof AttachmentMeta>;

/**
 * An ingest turn: one user or assistant message as captured by the extension
 * or produced by an import adapter. The companion app is responsible for
 * upserting the parent conversation.
 */
export const IngestTurn = z.object({
  provider: Provider,
  providerConversationId: z.string().min(1),
  providerMessageId: z.string().min(1).optional(),
  title: z.string().optional(),
  model: z.string().optional(),
  role: Role,
  content: z.string(),
  contentFormat: ContentFormat.default("markdown"),
  createdAt: z.string().datetime().optional(), // ISO8601; server fills if missing
  tokensEstimate: z.number().int().nonnegative().optional(),
  attachments: z.array(AttachmentMeta).optional(),
  toolCalls: z.array(z.unknown()).optional(),
  source: Source.default("live_capture"),
  rawPayload: z.unknown().optional(),
});
export type IngestTurn = z.infer<typeof IngestTurn>;

export const IngestBatch = z.object({
  turns: z.array(IngestTurn).min(1),
});
export type IngestBatch = z.infer<typeof IngestBatch>;

export const Conversation = z.object({
  id: z.string(),
  provider: Provider,
  providerConversationId: z.string(),
  title: z.string().nullable(),
  model: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()),
  source: Source,
  messageCount: z.number().int().nonnegative(),
});
export type Conversation = z.infer<typeof Conversation>;

export const Message = z.object({
  id: z.string(),
  conversationId: z.string(),
  providerMessageId: z.string().nullable(),
  role: Role,
  content: z.string(),
  contentFormat: ContentFormat,
  createdAt: z.string(),
  tokensEstimate: z.number().int().nullable(),
  attachments: z.array(AttachmentMeta),
  toolCalls: z.array(z.unknown()),
});
export type Message = z.infer<typeof Message>;
