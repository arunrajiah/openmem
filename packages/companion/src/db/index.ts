import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { runMigrations } from "./migrations.js";

export function openDb(dbPath: string): DB {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  runMigrations(db);
  return db;
}

export type { DB };
