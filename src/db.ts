/**
 * Read-only SQLite access via Node's built-in `node:sqlite` (Node >= 22.5).
 *
 * Chosen over better-sqlite3 deliberately: zero dependencies, zero native build,
 * no node-gyp / prebuilds. That keeps `npm install` frictionless for an
 * evaluator on any platform — the locked north star for this artifact.
 *
 * node:sqlite is loaded via DYNAMIC import (not a static one) so it pulls in
 * only at the first tool call — after the experimental-warning suppressor in
 * index.ts has installed its override. A static import would hoist the load
 * ahead of the suppressor and leak the warning to stderr.
 *
 * There is no write surface anywhere: the DB is opened { readOnly: true } and
 * the engine rejects any write (verified).
 */
import { existsSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import type { ServerConfig } from "./config.js";

export interface OpenDbResult {
  db: DatabaseSync | null;
  /** True when the DB file does not exist — callers should return vault-empty. */
  missing: boolean;
}

let DatabaseSyncCtor: typeof DatabaseSync | null = null;

export async function openReadOnly(cfg: ServerConfig): Promise<OpenDbResult> {
  if (!existsSync(cfg.dbPath)) {
    return { db: null, missing: true };
  }
  if (!DatabaseSyncCtor) {
    DatabaseSyncCtor = (await import("node:sqlite")).DatabaseSync;
  }
  const db = new DatabaseSyncCtor(cfg.dbPath, { readOnly: true });
  return { db, missing: false };
}
