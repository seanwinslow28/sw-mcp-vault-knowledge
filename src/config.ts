/**
 * Configuration + privacy boundary.
 *
 * Scope is config-only — NEVER a request parameter. A malicious client cannot
 * widen what this server can read by passing a path; the allowlist is resolved
 * once, here, from environment variables and frozen.
 *
 * Locked privacy boundary (spec §3b): only knowledge/{concepts,connections,qa}
 * is ever readable. Never 00_inbox, health, 90_system, 60_archive,
 * operating-models, prj-job-hunt-2026, the-block.
 */
import { resolve, sep } from "node:path";

/** Subdirectories of the vault that may be read. Hard-coded; not configurable by request. */
export const READABLE_SUBDIRS = ["concepts", "connections", "qa"] as const;
export type ReadableSubdir = (typeof READABLE_SUBDIRS)[number];

export interface ServerConfig {
  /** Absolute path to the read-only SQLite index. */
  dbPath: string;
  /** Absolute path to the vault root (the parent of the knowledge/ tree). */
  vaultRoot: string;
  /**
   * Absolute, resolved allowlist roots. Every file the server returns must live
   * under one of these prefixes or the read is refused.
   */
  allowedRoots: string[];
  /** Knowledge subtree prefix used to match chunk/file paths in the DB. */
  knowledgeDir: string;
}

/**
 * Resolve config from the environment.
 *
 * Env vars (v0.1 — Sean's machine):
 *   VAULT_DB        absolute path to .vault-index.db        (required)
 *   VAULT_ROOT      absolute path to vault root             (required)
 *   VAULT_KNOWLEDGE_DIR  name of the knowledge subtree      (default: "knowledge")
 *
 * v0.2 generalizes VAULT_ROOT so anyone can point at their own vault.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const dbPath = env.VAULT_DB?.trim();
  const vaultRoot = env.VAULT_ROOT?.trim();
  const knowledgeName = (env.VAULT_KNOWLEDGE_DIR?.trim() || "knowledge").replace(/^\/+|\/+$/g, "");

  if (!dbPath) {
    throw new Error("VAULT_DB is required (absolute path to the read-only .vault-index.db).");
  }
  if (!vaultRoot) {
    throw new Error("VAULT_ROOT is required (absolute path to the vault root).");
  }

  const absDb = resolve(dbPath);
  const absVault = resolve(vaultRoot);
  const knowledgeDir = resolve(absVault, knowledgeName);

  // Allowlist: only the three knowledge subdirectories, fully resolved.
  const allowedRoots = READABLE_SUBDIRS.map((sub) => resolve(knowledgeDir, sub));

  return { dbPath: absDb, vaultRoot: absVault, allowedRoots, knowledgeDir };
}

/**
 * Path guard. Returns true only if `candidate`, once resolved, lives under one
 * of the allowlist roots. Prevents `..` traversal and symlink-style escapes by
 * comparing resolved absolute prefixes with a trailing separator.
 */
export function isPathAllowed(candidate: string, cfg: ServerConfig): boolean {
  const abs = resolve(candidate);
  return cfg.allowedRoots.some((root) => abs === root || abs.startsWith(root + sep));
}
