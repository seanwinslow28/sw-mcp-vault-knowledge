/**
 * Read-only SQLite access. There is no write surface anywhere in this server.
 *
 * better-sqlite3 is opened with { readonly: true, fileMustExist: true }. If the
 * file is missing we surface that as a clean empty-state upstream rather than
 * throwing an opaque error.
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import type { ServerConfig } from "./config.js";

export interface OpenDbResult {
  db: Database.Database | null;
  /** True when the DB file does not exist — callers should return vault-empty. */
  missing: boolean;
}

export function openReadOnly(cfg: ServerConfig): OpenDbResult {
  if (!existsSync(cfg.dbPath)) {
    return { db: null, missing: true };
  }
  const db = new Database(cfg.dbPath, { readonly: true, fileMustExist: true });
  // Defense in depth: refuse to be tricked into writes even if a query tries.
  db.pragma("query_only = ON");
  return { db, missing: false };
}
