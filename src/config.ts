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
import { relative, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
  /** Absolute knowledge subtree path (parent of concepts/connections/qa). */
  knowledgeDir: string;
  /**
   * Knowledge dir relative to vault root (e.g. "knowledge"). chunks.file_path in
   * the DB is vault-root-relative, so SQL LIKE prefixes are built from this.
   */
  knowledgeRel: string;
  /** True when running against the bundled public demo vault (no env set). */
  demo: boolean;
}

/** Absolute path to the bundled demo vault (ships in the npm package). */
function demoVaultRoot(): string {
  // config.js lives in build/; the demo vault ships at <pkg>/examples/demo-vault.
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "examples", "demo-vault");
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

  // Zero-config demo mode: with NEITHER env var set, serve the bundled public
  // espresso vault so `npx` works out of the box. Setting one without the other
  // is a misconfiguration and fails loudly.
  let absDb: string;
  let absVault: string;
  let demo = false;
  if (!dbPath && !vaultRoot) {
    absVault = demoVaultRoot();
    absDb = resolve(absVault, "demo-index.db");
    demo = true;
  } else {
    if (!dbPath) {
      throw new Error(
        "VAULT_DB is required when VAULT_ROOT is set (or unset both for the demo vault).",
      );
    }
    if (!vaultRoot) {
      throw new Error(
        "VAULT_ROOT is required when VAULT_DB is set (or unset both for the demo vault).",
      );
    }
    absDb = resolve(dbPath);
    absVault = resolve(vaultRoot);
  }

  const knowledgeDir = resolve(absVault, knowledgeName);

  // Allowlist: only the three knowledge subdirectories, fully resolved.
  const allowedRoots = READABLE_SUBDIRS.map((sub) => resolve(knowledgeDir, sub));
  const knowledgeRel = relative(absVault, knowledgeDir).split(sep).join("/");

  return { dbPath: absDb, vaultRoot: absVault, allowedRoots, knowledgeDir, knowledgeRel, demo };
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
