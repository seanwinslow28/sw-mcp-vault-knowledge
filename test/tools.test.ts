/**
 * Hermetic tests — build a synthetic temp vault + index.db with node:sqlite, then
 * exercise the real tool code paths. No live vault, no model download required.
 *
 * Covered: find_contradictions (all + recent_30d + empty), get_article (ok,
 * wikilinks in/out, not-found, traversal-blocked), empty-state honesty against a
 * missing DB, the path-allowlist guard, and the embeddings math (blob + cosine).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { loadConfig, isPathAllowed } from "../src/config.js";
import { blobToVector, cosineSimilarity } from "../src/embeddings.js";
import { findContradictions } from "../src/tools/find_contradictions.js";
import { getArticle } from "../src/tools/get_article.js";
import { searchConcepts } from "../src/tools/search_concepts.js";

function buildFixture() {
  const root = mkdtempSync(join(tmpdir(), "vkmcp-"));
  const vaultRoot = join(root, "vault");
  const concepts = join(vaultRoot, "knowledge", "concepts");
  mkdirSync(concepts, { recursive: true });

  writeFileSync(
    join(concepts, "espresso-extraction.md"),
    `---\ntitle: Espresso Extraction\ntags: [coffee, extraction]\n---\n\n# Espresso Extraction\n\nExtraction depends on [[grind-size]] and [[pump-pressure|pressure]].\n`,
  );

  const dbPath = join(vaultRoot, ".vault-index.db");
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE concept_edges (
    id INTEGER PRIMARY KEY, from_slug TEXT, to_slug TEXT, relation TEXT,
    confidence REAL, valid_until TEXT, classifier_version TEXT,
    source_synth_run TEXT, created_at TEXT)`);
  const now = new Date().toISOString().replace(/\.\d+Z$/, "");
  const old = "2026-01-01T00:00:00";
  const ins = db.prepare(
    `INSERT INTO concept_edges (from_slug,to_slug,relation,confidence,valid_until,source_synth_run,created_at)
     VALUES (?,?,?,?,?,?,?)`,
  );
  ins.run("grind-size", "espresso-extraction", "contradicts", 0.8, null, "run-recent", now);
  ins.run("water-chemistry", "tamping", "contradicts", 0.7, null, "run-old", old);
  ins.run("dose-ratio", "lever-machine", "supports", 0.9, null, "run-recent", now); // not a contradiction
  ins.run("pre-infusion", "pump-pressure", "contradicts", 0.6, "2026-05-01T00:00:00", "run-x", now); // retired (valid_until set)
  db.close();

  return { root, vaultRoot, dbPath };
}

function cfgFor(vaultRoot: string, dbPath: string) {
  return loadConfig({ VAULT_DB: dbPath, VAULT_ROOT: vaultRoot } as NodeJS.ProcessEnv);
}

test("find_contradictions(all) returns only active contradiction edges", async () => {
  const fx = buildFixture();
  try {
    const cfg = cfgFor(fx.vaultRoot, fx.dbPath);
    const res = await findContradictions({ scope: "all" }, cfg);
    assert.equal(res.status, "ok");
    // 2 active contradictions (the supports edge and the retired edge are excluded)
    assert.equal(res.results.length, 2);
    assert.ok(res.results.every((e) => e.from_slug && e.to_slug));
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("find_contradictions(recent_30d) filters out old edges", async () => {
  const fx = buildFixture();
  try {
    const cfg = cfgFor(fx.vaultRoot, fx.dbPath);
    const res = await findContradictions({ scope: "recent_30d" }, cfg);
    assert.equal(res.status, "ok");
    // only the 'now' contradiction; the 2026-01-01 one is outside 30 days
    assert.equal(res.results.length, 1);
    assert.equal(res.results[0].to_slug, "espresso-extraction");
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("get_article returns frontmatter, body, and resolved wikilinks", async () => {
  const fx = buildFixture();
  try {
    const cfg = cfgFor(fx.vaultRoot, fx.dbPath);
    const res = await getArticle({ slug: "espresso-extraction" }, cfg);
    assert.equal(res.status, "ok");
    assert.equal(res.frontmatter?.title, "Espresso Extraction");
    assert.deepEqual(res.wikilinks_out?.sort(), ["grind-size", "pump-pressure"]);
    // inbound: grind-size contradicts espresso-extraction (active edge)
    assert.deepEqual(res.wikilinks_in, ["grind-size"]);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("get_article on a missing slug returns clean not-found", async () => {
  const fx = buildFixture();
  try {
    const cfg = cfgFor(fx.vaultRoot, fx.dbPath);
    const res = await getArticle({ slug: "does-not-exist" }, cfg);
    assert.equal(res.status, "not-found");
    assert.ok(res.message);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("get_article cannot escape the allowlist via traversal", async () => {
  const fx = buildFixture();
  try {
    const cfg = cfgFor(fx.vaultRoot, fx.dbPath);
    const res = await getArticle({ slug: "../../../../../etc/passwd" }, cfg);
    assert.equal(res.status, "not-found");
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("privacy: a range of malicious slugs are all refused", async () => {
  const fx = buildFixture();
  try {
    const cfg = cfgFor(fx.vaultRoot, fx.dbPath);
    const attacks = [
      "../../../../etc/passwd",
      "/etc/passwd",
      "..%2f..%2fsecret",
      "../expansions/leak",
      "../../health/secret",
      "....//....//etc/hosts",
    ];
    for (const slug of attacks) {
      const res = await getArticle({ slug }, cfg);
      assert.equal(res.status, "not-found", `slug should be refused: ${slug}`);
    }
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("empty-state: missing DB yields clean vault-empty / not-found, never a throw", async () => {
  const fx = buildFixture();
  try {
    const cfg = cfgFor(fx.vaultRoot, join(fx.vaultRoot, "nonexistent.db"));
    const c = await findContradictions({ scope: "all" }, cfg);
    assert.equal(c.status, "vault-empty");
    assert.deepEqual(c.results, []);
    const s = await searchConcepts({ query: "anything", limit: 5 }, cfg);
    assert.equal(s.status, "vault-empty");
    assert.deepEqual(s.results, []);
    // get_article still resolves the file (DB only powers inbound links)
    const a = await getArticle({ slug: "espresso-extraction" }, cfg);
    assert.equal(a.status, "ok");
    assert.deepEqual(a.wikilinks_in, []);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("path allowlist accepts in-scope, rejects out-of-scope", () => {
  const fx = buildFixture();
  try {
    const cfg = cfgFor(fx.vaultRoot, fx.dbPath);
    assert.equal(isPathAllowed(resolve(cfg.knowledgeDir, "concepts", "x.md"), cfg), true);
    assert.equal(isPathAllowed(resolve(cfg.knowledgeDir, "expansions", "x.md"), cfg), false);
    assert.equal(isPathAllowed(resolve(cfg.vaultRoot, "health", "secret.md"), cfg), false);
    assert.equal(isPathAllowed("/etc/passwd", cfg), false);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("config: no env → demo vault; partial env → loud failure", () => {
  // Neither set → bundled demo vault.
  const demo = loadConfig({} as NodeJS.ProcessEnv);
  assert.equal(demo.demo, true);
  assert.match(demo.knowledgeDir, /demo-vault[/\\]knowledge$/);
  // One without the other is a misconfiguration.
  assert.throws(() => loadConfig({ VAULT_DB: "/x.db" } as NodeJS.ProcessEnv), /VAULT_ROOT is required/);
  assert.throws(
    () => loadConfig({ VAULT_ROOT: "/x" } as NodeJS.ProcessEnv),
    /VAULT_DB is required/,
  );
});

test("embeddings: blob round-trips and cosine behaves", () => {
  const v = Float32Array.from([0.1, -0.2, 0.3, 0.4]);
  const blob = Buffer.from(v.buffer);
  const back = blobToVector(blob);
  assert.equal(back.length, 4);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(back[i] - v[i]) < 1e-6);
  assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-6);
  assert.equal(cosineSimilarity(Float32Array.from([1, 0]), Float32Array.from([0, 1])), 0);
});
