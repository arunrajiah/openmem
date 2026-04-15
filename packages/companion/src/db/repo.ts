import type { DB } from "./index.js";
import type { IngestTurn, Conversation, Message } from "@openmem/shared";
import { newId, contentHash } from "../lib/ids.js";

export interface IngestResult {
  conversationId: string;
  messageId: string;
  deduplicated: boolean;
}

// ── Raw SQLite row shapes ─────────────────────────────────────────────────────

interface ConvRow {
  id: string;
  provider: string;
  provider_conversation_id: string;
  title: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
  tags_json: string;
  source: string;
  message_count: number;
}

interface MsgRow {
  id: string;
  conversation_id: string;
  provider_message_id: string | null;
  role: string;
  content: string;
  content_format: string;
  created_at: string;
  tokens_estimate: number | null;
  attachments_json: string;
  tool_calls_json: string;
}

interface SearchRow {
  message_id: string;
  conversation_id: string;
  conversation_title: string | null;
  provider: string;
  model: string | null;
  role: string;
  snippet: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export class Repo {
  constructor(private db: DB) {}

  ingestTurn(turn: IngestTurn): IngestResult {
    const now = new Date().toISOString();
    const createdAt = turn.createdAt ?? now;

    const ingest = this.db.transaction((): IngestResult => {
      // Upsert conversation
      const existing = this.db
        .prepare(
          "SELECT id FROM conversation WHERE provider = ? AND provider_conversation_id = ?",
        )
        .get(turn.provider, turn.providerConversationId) as { id: string } | undefined;

      let conversationId: string;
      if (existing) {
        conversationId = existing.id;
        this.db
          .prepare(
            `UPDATE conversation
             SET updated_at = ?,
                 title = COALESCE(?, title),
                 model = COALESCE(?, model)
             WHERE id = ?`,
          )
          .run(now, turn.title ?? null, turn.model ?? null, conversationId);
      } else {
        conversationId = newId("conv");
        this.db
          .prepare(
            `INSERT INTO conversation
               (id, provider, provider_conversation_id, title, model, created_at, updated_at, tags_json, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?)`,
          )
          .run(
            conversationId,
            turn.provider,
            turn.providerConversationId,
            turn.title ?? null,
            turn.model ?? null,
            createdAt,
            now,
            turn.source,
          );
      }

      const hash = contentHash(turn.content);

      // Dedup: by providerMessageId first, then by (conversation, role, hash)
      if (turn.providerMessageId) {
        const existingMsg = this.db
          .prepare(
            "SELECT id FROM message WHERE conversation_id = ? AND provider_message_id = ?",
          )
          .get(conversationId, turn.providerMessageId) as { id: string } | undefined;
        if (existingMsg) {
          return { conversationId, messageId: existingMsg.id, deduplicated: true };
        }
      }
      const dupByHash = this.db
        .prepare(
          "SELECT id FROM message WHERE conversation_id = ? AND role = ? AND content_hash = ?",
        )
        .get(conversationId, turn.role, hash) as { id: string } | undefined;
      if (dupByHash) {
        return { conversationId, messageId: dupByHash.id, deduplicated: true };
      }

      const messageId = newId("msg");
      this.db
        .prepare(
          `INSERT INTO message
             (id, conversation_id, provider_message_id, role, content, content_format,
              created_at, tokens_estimate, attachments_json, tool_calls_json, content_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          messageId,
          conversationId,
          turn.providerMessageId ?? null,
          turn.role,
          turn.content,
          turn.contentFormat,
          createdAt,
          turn.tokensEstimate ?? null,
          JSON.stringify(turn.attachments ?? []),
          JSON.stringify(turn.toolCalls ?? []),
          hash,
        );

      if (turn.rawPayload !== undefined) {
        this.db
          .prepare("INSERT INTO raw_payload (message_id, payload_json) VALUES (?, ?)")
          .run(messageId, JSON.stringify(turn.rawPayload));
      }

      return { conversationId, messageId, deduplicated: false };
    });

    return ingest();
  }

  listConversations(opts: {
    provider?: string | undefined;
    tag?: string | undefined;
    limit: number;
    offset: number;
  }): Conversation[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.provider) {
      where.push("c.provider = ?");
      params.push(opts.provider);
    }
    if (opts.tag) {
      where.push("EXISTS (SELECT 1 FROM json_each(c.tags_json) WHERE value = ?)");
      params.push(opts.tag);
    }
    const sql = `
      SELECT c.*, (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id) AS message_count
      FROM conversation c
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY c.updated_at DESC, c.rowid DESC
      LIMIT ? OFFSET ?`;
    params.push(opts.limit, opts.offset);
    const rows = this.db.prepare(sql).all(...params) as ConvRow[];
    return rows.map(rowToConversation);
  }

  getConversation(id: string): Conversation | null {
    const row = this.db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id) AS message_count
         FROM conversation c WHERE c.id = ?`,
      )
      .get(id) as ConvRow | undefined;
    return row ? rowToConversation(row) : null;
  }

  listMessages(conversationId: string): Message[] {
    const rows = this.db
      .prepare("SELECT * FROM message WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId) as MsgRow[];
    return rows.map(rowToMessage);
  }

  search(opts: {
    query: string;
    provider?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    limit: number;
    offset: number;
  }): { results: SearchResult[]; total: number } {
    // Sanitise: FTS5 throws on some inputs; wrap in try and return empty on error.
    const ftsQuery = sanitiseFtsQuery(opts.query);
    if (!ftsQuery) return { results: [], total: 0 };

    const conditions: string[] = ["message_fts MATCH ?"];
    const params: unknown[] = [ftsQuery];

    if (opts.provider) {
      conditions.push("c.provider = ?");
      params.push(opts.provider);
    }
    if (opts.from) {
      conditions.push("m.created_at >= ?");
      params.push(opts.from);
    }
    if (opts.to) {
      conditions.push("m.created_at <= ?");
      params.push(opts.to);
    }

    const where = conditions.join(" AND ");

    try {
      const countRow = this.db
        .prepare(
          `SELECT COUNT(*) as n
           FROM message_fts
           JOIN message m ON message_fts.rowid = m.rowid
           JOIN conversation c ON m.conversation_id = c.id
           WHERE ${where}`,
        )
        .get(...params) as { n: number };

      const rows = this.db
        .prepare(
          `SELECT
             m.id           AS message_id,
             m.conversation_id,
             m.role,
             m.created_at,
             c.provider,
             c.title        AS conversation_title,
             c.model,
             snippet(message_fts, 0, '<mark>', '</mark>', '…', 24) AS snippet
           FROM message_fts
           JOIN message m      ON message_fts.rowid = m.rowid
           JOIN conversation c ON m.conversation_id = c.id
           WHERE ${where}
           ORDER BY rank
           LIMIT ? OFFSET ?`,
        )
        .all(...params, opts.limit, opts.offset) as SearchRow[];

      return {
        results: rows.map(rowToSearchResult),
        total: countRow.n,
      };
    } catch {
      // FTS5 query parse error — treat as no results
      return { results: [], total: 0 };
    }
  }

  // ── Tags ───────────────────────────────────────────────────────────────────

  setTags(conversationId: string, tags: string[]): void {
    const unique = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE conversation SET tags_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(unique), now, conversationId);
  }

  /**
   * Return all tags in use across all conversations, with their conversation
   * counts, ordered by count desc.
   */
  listAllTags(): TagCount[] {
    const rows = this.db
      .prepare(
        `SELECT t.value AS tag, COUNT(*) AS count
         FROM conversation c, json_each(c.tags_json) t
         WHERE t.value != ''
         GROUP BY t.value
         ORDER BY count DESC, t.value ASC`,
      )
      .all() as { tag: string; count: number }[];
    return rows.map((r) => ({ tag: r.tag, count: r.count }));
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats(): DbStats {
    const conversations = (
      this.db.prepare("SELECT COUNT(*) AS n FROM conversation").get() as { n: number }
    ).n;

    const messages = (
      this.db.prepare("SELECT COUNT(*) AS n FROM message").get() as { n: number }
    ).n;

    const byProvider = this.db
      .prepare("SELECT provider, COUNT(*) AS n FROM conversation GROUP BY provider")
      .all() as { provider: string; n: number }[];

    const { page_count } = this.db
      .prepare("PRAGMA page_count")
      .get() as { page_count: number };
    const { page_size } = this.db
      .prepare("PRAGMA page_size")
      .get() as { page_size: number };
    const dbSizeBytes = page_count * page_size;

    const oldest = (
      this.db
        .prepare("SELECT MIN(created_at) AS d FROM conversation")
        .get() as { d: string | null }
    ).d;
    const newest = (
      this.db
        .prepare("SELECT MAX(updated_at) AS d FROM conversation")
        .get() as { d: string | null }
    ).d;

    return {
      conversations,
      messages,
      byProvider: Object.fromEntries(byProvider.map((r) => [r.provider, r.n])),
      dbSizeBytes,
      oldestConversation: oldest,
      newestConversation: newest,
    };
  }

  /** Also allow tag-based filtering in listConversations */
  listConversationsByTag(tag: string, limit: number, offset: number): Conversation[] {
    const rows = this.db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id) AS message_count
         FROM conversation c
         WHERE EXISTS (SELECT 1 FROM json_each(c.tags_json) WHERE value = ?)
         ORDER BY c.updated_at DESC, c.rowid DESC
         LIMIT ? OFFSET ?`,
      )
      .all(tag, limit, offset) as ConvRow[];
    return rows.map(rowToConversation);
  }
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface DbStats {
  conversations: number;
  messages: number;
  byProvider: Record<string, number>;
  dbSizeBytes: number;
  oldestConversation: string | null;
  newestConversation: string | null;
}

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

/**
 * Strip characters that have special meaning in FTS5 query syntax so that a
 * plain user search string doesn't throw a parse error.
 * We keep alphanumerics, spaces, and hyphens; everything else is removed.
 */
function sanitiseFtsQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[^\w\s'-]/g, " ")  // strip FTS5 specials except hyphen/apostrophe
    .replace(/\s+/g, " ")
    .trim();
}

function rowToSearchResult(r: SearchRow): SearchResult {
  return {
    messageId: r.message_id,
    conversationId: r.conversation_id,
    conversationTitle: r.conversation_title,
    provider: r.provider,
    model: r.model,
    role: r.role,
    snippet: r.snippet,
    createdAt: r.created_at,
  };
}

function rowToConversation(r: ConvRow): Conversation {
  return {
    id: r.id,
    // SQLite stores these as strings; values were validated by Zod on ingest
    provider: r.provider as Conversation["provider"],
    providerConversationId: r.provider_conversation_id,
    title: r.title,
    model: r.model,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    tags: JSON.parse(r.tags_json) as string[],
    source: r.source as Conversation["source"],
    messageCount: r.message_count ?? 0,
  };
}

function rowToMessage(r: MsgRow): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    providerMessageId: r.provider_message_id,
    // SQLite stores these as strings; values were validated by Zod on ingest
    role: r.role as Message["role"],
    content: r.content,
    contentFormat: r.content_format as Message["contentFormat"],
    createdAt: r.created_at,
    tokensEstimate: r.tokens_estimate,
    attachments: JSON.parse(r.attachments_json) as Message["attachments"],
    toolCalls: JSON.parse(r.tool_calls_json) as Message["toolCalls"],
  };
}
