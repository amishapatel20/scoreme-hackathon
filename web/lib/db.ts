import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

export type Db = Database.Database;

function resolveDbPath(): string {
  const envPath = process.env.DB_PATH?.trim();
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
  }

  if (process.env.VERCEL) {
    return "/tmp/decision_platform.db";
  }

  return path.join(process.cwd(), ".data", "decision_platform.db");
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function initSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      workflow_name TEXT NOT NULL,
      workflow_version TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      current_stage TEXT,
      decision TEXT,
      explanation_json TEXT NOT NULL,
      last_error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(workflow_name, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS request_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      stage_id TEXT,
      message TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(id)
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      workflow_name TEXT NOT NULL,
      stage_id TEXT,
      rule_id TEXT,
      event_type TEXT NOT NULL,
      outcome TEXT NOT NULL,
      message TEXT NOT NULL,
      data_refs_json TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(id)
    );
  `);
}

declare global {
  // eslint-disable-next-line no-var
  var __decision_platform_db__: Db | undefined;
}

export function getDb(): Db {
  if (globalThis.__decision_platform_db__) {
    return globalThis.__decision_platform_db__;
  }

  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  initSchema(db);

  globalThis.__decision_platform_db__ = db;
  return db;
}

export function runInTransaction<T>(fn: (db: Db) => T): T {
  const db = getDb();
  const tx = db.transaction(() => fn(db));
  return tx();
}
