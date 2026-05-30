#!/usr/bin/env node
/**
 * Build the public demo vault index from the bundled espresso fixture.
 *
 *   npm run build                       # compile src → build (for embeddings)
 *   node scripts/build-demo-vault.mjs   # writes examples/demo-vault/demo-index.db
 *   node scripts/build-demo-vault.mjs --no-embed   # NULL embeddings (CI / no model)
 *
 * The output DB mirrors the real .vault-index.db schema (chunks + concept_edges +
 * index_meta) so the three tools run against it unchanged. Embeddings use the
 * SAME model as the query path (nomic-embed-text-v1.5 via Transformers.js), so
 * the recruiter's search_concepts is exact-parity — no cross-engine drift.
 *
 * Everything here is synthetic espresso content. Never fold real notes in.
 */
import { readFileSync, readdirSync, existsSync, rmSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const noEmbed = process.argv.includes("--no-embed");
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");
// DEMO_VAULT_ROOT lets CI build onto a native FS (the bundled examples/ dir is
// the default and what ships).
const vaultRoot = process.env.DEMO_VAULT_ROOT
  ? resolve(process.env.DEMO_VAULT_ROOT)
  : join(repo, "examples", "demo-vault");
const conceptsDir = join(vaultRoot, "knowledge", "concepts");
const edgesPath = join(vaultRoot, "edges.json");
const dbPath = join(vaultRoot, "demo-index.db");

let embedQuery = null;
if (!noEmbed) {
  ({ embedQuery } = await import("../build/embeddings.js"));
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, "");
}

// Wipe any prior DB + transient journal/WAL/SHM so the rebuild is clean.
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  const p = dbPath + suffix;
  if (existsSync(p)) rmSync(p, { force: true });
}
const db = new DatabaseSync(dbPath);

db.exec(`
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding BLOB,
  file_mtime REAL NOT NULL,
  indexed_at TEXT NOT NULL,
  UNIQUE(file_path, chunk_index)
);
CREATE TABLE concept_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_slug TEXT NOT NULL,
  to_slug TEXT NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN
    ('supports','contradicts','evolved_into','supersedes','depends_on','related_to')),
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  valid_until TEXT,
  classifier_version TEXT,
  source_synth_run TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(from_slug, to_slug, relation),
  CHECK (from_slug != to_slug)
);
CREATE TABLE index_meta (key TEXT PRIMARY KEY, value TEXT);
`);

// --- chunks (one chunk per short fixture note) ---
const files = readdirSync(conceptsDir).filter((f) => f.endsWith(".md"));
const insChunk = db.prepare(
  `INSERT INTO chunks (file_path, chunk_index, chunk_text, embedding, file_mtime, indexed_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
let embedded = 0;
for (const f of files) {
  const abs = join(conceptsDir, f);
  const text = readFileSync(abs, "utf8");
  const relPath = `knowledge/concepts/${f}`;
  let blob = null;
  if (!noEmbed) {
    const vec = await embedQuery(text); // same model/settings as the query path
    blob = Buffer.from(new Float32Array(vec).buffer);
    embedded++;
  }
  insChunk.run(relPath, 0, text, blob, statSync(abs).mtimeMs / 1000, nowIso());
}

// --- concept_edges (from the canonical edge manifest) ---
const { edges } = JSON.parse(readFileSync(edgesPath, "utf8"));
const insEdge = db.prepare(
  `INSERT INTO concept_edges
     (from_slug, to_slug, relation, confidence, valid_until, classifier_version, source_synth_run, created_at)
   VALUES (?, ?, ?, ?, NULL, 'demo-v1', 'demo-fixture', ?)`,
);
const created = nowIso();
for (const e of edges) {
  insEdge.run(e.from_slug, e.to_slug, e.relation, e.confidence ?? null, created);
}

db.prepare("INSERT INTO index_meta (key, value) VALUES ('last_run', ?)").run(nowIso());
db.prepare("INSERT INTO index_meta (key, value) VALUES ('total_chunks', ?)").run(String(files.length));
db.close();

const contradictions = edges.filter((e) => e.relation === "contradicts").length;
console.error(
  `demo vault built: ${dbPath}\n  ${files.length} concept chunks (${embedded} embedded${
    noEmbed ? ", --no-embed" : ""
  }), ${edges.length} edges (${contradictions} contradictions)`,
);
