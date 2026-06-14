import type { DB } from "./index.js";
import type { IngestTurn, Conversation, Message } from "@openmem/shared";
import { newId, contentHash } from "../lib/ids.js";
import { type EncryptionKey, encrypt, decrypt } from "../lib/crypto.js";

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
  content: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export class Repo {
  constructor(
    private db: DB,
    private key: EncryptionKey | null = null,
  ) {}

  // ── Encryption helpers ─────────────────────────────────────────────────────

  private enc(value: string): string {
    return this.key ? encrypt(this.key, value) : value;
  }

  private dec(value: string): string {
    return this.key ? decrypt(this.key, value) : value;
  }

  private decOrNull(value: string | null): string | null {
    return value === null ? null : this.dec(value);
  }

  // ── FTS helpers (manual — auto-triggers were dropped in migration 002) ─────

  private ftsInsert(rowid: number, plainContent: string): void {
    this.db
      .prepare("INSERT INTO message_fts(rowid, content) VALUES (?, ?)")
      .run(rowid, plainContent);
  }

  private ftsDelete(rowid: number, plainContent: string): void {
    this.db
      .prepare(
        "INSERT INTO message_fts(message_fts, rowid, content) VALUES ('delete', ?, ?)",
      )
      .run(rowid, plainContent);
  }

  // ── Ingest ─────────────────────────────────────────────────────────────────

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
          .run(
            now,
            turn.title ? this.enc(turn.title) : null,
            turn.model ?? null,
            conversationId,
          );
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
            turn.title ? this.enc(turn.title) : null,
            turn.model ?? null,
            createdAt,
            now,
            turn.source,
          );
      }

      // Hash computed on plaintext — dedup is key-independent
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
          this.enc(turn.content),
          turn.contentFormat,
          createdAt,
          turn.tokensEstimate ?? null,
          JSON.stringify(turn.attachments ?? []),
          JSON.stringify(turn.toolCalls ?? []),
          hash,
        );

      // Feed plaintext to the FTS index (triggers were dropped in migration 002)
      const { rowid } = this.db
        .prepare("SELECT rowid FROM message WHERE id = ?")
        .get(messageId) as { rowid: number };
      this.ftsInsert(rowid, turn.content);

      if (turn.rawPayload !== undefined) {
        this.db
          .prepare("INSERT INTO raw_payload (message_id, payload_json) VALUES (?, ?)")
          .run(messageId, this.enc(JSON.stringify(turn.rawPayload)));
      }

      return { conversationId, messageId, deduplicated: false };
    });

    return ingest();
  }

  // ── Conversations ──────────────────────────────────────────────────────────

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
    return rows.map((r) => this.rowToConversation(r));
  }

  getConversation(id: string): Conversation | null {
    const row = this.db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id) AS message_count
         FROM conversation c WHERE c.id = ?`,
      )
      .get(id) as ConvRow | undefined;
    return row ? this.rowToConversation(row) : null;
  }

  listMessages(conversationId: string): Message[] {
    const rows = this.db
      .prepare("SELECT * FROM message WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId) as MsgRow[];
    return rows.map((r) => this.rowToMessage(r));
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  search(opts: {
    query: string;
    provider?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    limit: number;
    offset: number;
  }): { results: SearchResult[]; total: number } {
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

      // Load raw content instead of using snippet() — we decrypt and generate
      // the snippet in Node.js so it works regardless of encryption state.
      const rows = this.db
        .prepare(
          `SELECT
             m.id           AS message_id,
             m.conversation_id,
             m.role,
             m.created_at,
             m.content,
             c.provider,
             c.title        AS conversation_title,
             c.model
           FROM message_fts
           JOIN message m      ON message_fts.rowid = m.rowid
           JOIN conversation c ON m.conversation_id = c.id
           WHERE ${where}
           ORDER BY rank
           LIMIT ? OFFSET ?`,
        )
        .all(...params, opts.limit, opts.offset) as SearchRow[];

      return {
        results: rows.map((r) => ({
          messageId: r.message_id,
          conversationId: r.conversation_id,
          conversationTitle: this.decOrNull(r.conversation_title),
          provider: r.provider,
          model: r.model,
          role: r.role,
          snippet: makeSnippet(this.dec(r.content), opts.query),
          createdAt: r.created_at,
        })),
        total: countRow.n,
      };
    } catch {
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

    const { page_count } = this.db.prepare("PRAGMA page_count").get() as {
      page_count: number;
    };
    const { page_size } = this.db.prepare("PRAGMA page_size").get() as {
      page_size: number;
    };
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
      encrypted: this.key !== null,
    };
  }

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
    return rows.map((r) => this.rowToConversation(r));
  }

  // ── Row mappers ────────────────────────────────────────────────────────────

  private rowToConversation(r: ConvRow): Conversation {
    return {
      id: r.id,
      provider: r.provider as Conversation["provider"],
      providerConversationId: r.provider_conversation_id,
      title: this.decOrNull(r.title),
      model: r.model,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      tags: JSON.parse(r.tags_json) as string[],
      source: r.source as Conversation["source"],
      messageCount: r.message_count ?? 0,
    };
  }

  private rowToMessage(r: MsgRow): Message {
    return {
      id: r.id,
      conversationId: r.conversation_id,
      providerMessageId: r.provider_message_id,
      role: r.role as Message["role"],
      content: this.dec(r.content),
      contentFormat: r.content_format as Message["contentFormat"],
      createdAt: r.created_at,
      tokensEstimate: r.tokens_estimate,
      attachments: JSON.parse(r.attachments_json) as Message["attachments"],
      toolCalls: JSON.parse(r.tool_calls_json) as Message["toolCalls"],
    };
  }
}

// ── Public types ──────────────────────────────────────────────────────────────

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
  encrypted: boolean;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitiseFtsQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate a search-result snippet in Node.js.
 * Replaces the SQLite snippet() call so it works on decrypted content.
 */
function makeSnippet(content: string, query: string): string {
  const terms = sanitiseFtsQuery(query)
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const lower = content.toLowerCase();
  let anchor = 0;
  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1) {
      anchor = idx;
      break;
    }
  }

  const start = Math.max(0, anchor - 80);
  const end = Math.min(content.length, anchor + 160);
  let snippet = content
    .slice(start, end)
    .replace(/\n{2,}/g, " ¶ ")
    .replace(/\n/g, " ");

  if (start > 0) snippet = "…" + snippet;
  if (end < content.length) snippet += "…";

  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    snippet = snippet.replace(new RegExp(escaped, "gi"), "<mark>$&</mark>");
  }
  return snippet;
}
