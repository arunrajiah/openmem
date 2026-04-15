import type { Database } from "better-sqlite3";

/**
 * Migrations are append-only. Each entry runs once in order and is recorded in
 * the `schema_migrations` table. Never edit a migration that has shipped —
 * add a new one.
 */
interface Migration {
  id: number;
  name: string;
  up: (db: Database) => void;
}

const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "init",
    up: (db) => {
      db.exec(`
        CREATE TABLE conversation (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          provider_conversation_id TEXT NOT NULL,
          title TEXT,
          model TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          tags_json TEXT NOT NULL DEFAULT '[]',
          source TEXT NOT NULL,
          UNIQUE(provider, provider_conversation_id)
        );

        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
          provider_message_id TEXT,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          content_format TEXT NOT NULL DEFAULT 'markdown',
          created_at TEXT NOT NULL,
          tokens_estimate INTEGER,
          attachments_json TEXT NOT NULL DEFAULT '[]',
          tool_calls_json TEXT NOT NULL DEFAULT '[]',
          content_hash TEXT NOT NULL
        );

        CREATE INDEX idx_message_conversation ON message(conversation_id, created_at);
        CREATE UNIQUE INDEX idx_message_provider_msgid
          ON message(conversation_id, provider_message_id)
          WHERE provider_message_id IS NOT NULL;
        CREATE UNIQUE INDEX idx_message_dedup_hash
          ON message(conversation_id, role, content_hash);

        CREATE TABLE provider_account (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          display_name TEXT,
          last_synced_at TEXT
        );

        CREATE TABLE raw_payload (
          message_id TEXT PRIMARY KEY REFERENCES message(id) ON DELETE CASCADE,
          payload_json TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE message_fts USING fts5(
          content,
          content='message',
          content_rowid='rowid',
          tokenize='unicode61'
        );

        CREATE TRIGGER message_ai AFTER INSERT ON message BEGIN
          INSERT INTO message_fts(rowid, content) VALUES (new.rowid, new.content);
        END;
        CREATE TRIGGER message_ad AFTER DELETE ON message BEGIN
          INSERT INTO message_fts(message_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
        END;
        CREATE TRIGGER message_au AFTER UPDATE ON message BEGIN
          INSERT INTO message_fts(message_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
          INSERT INTO message_fts(rowid, content) VALUES (new.rowid, new.content);
        END;
      `);
    },
  },
];

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((r: any) => r.id as number),
  );
  const record = db.prepare(
    "INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)",
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    const tx = db.transaction(() => {
      m.up(db);
      record.run(m.id, m.name, new Date().toISOString());
    });
    tx();
  }
}
