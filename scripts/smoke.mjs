#!/usr/bin/env node
/**
 * Live smoke test — exercises all 3 tools against a real vault. Run on a machine
 * with network access (search_concepts downloads the embedding model once).
 *
 *   npm run build
 *   VAULT_DB=/abs/.vault-index.db VAULT_ROOT=/abs/vault node scripts/smoke.mjs
 *
 * Reads .env if present. Prints each tool's status + a sample of results.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env loader (no dep).
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { loadConfig } = await import("../build/config.js");
const { searchConcepts } = await import("../build/tools/search_concepts.js");
const { findContradictions } = await import("../build/tools/find_contradictions.js");
const { getArticle } = await import("../build/tools/get_article.js");

const cfg = loadConfig();
console.log("config:", { db: cfg.dbPath, knowledge: cfg.knowledgeDir });

console.log("\n── find_contradictions(recent_30d) ──");
const c = await findContradictions({ scope: "recent_30d" }, cfg);
console.log(c.status, "·", c.results.length, "edges");
for (const e of c.results.slice(0, 5)) console.log(`  ${e.from_slug}  ⨯  ${e.to_slug}  (${e.confidence})`);

console.log("\n── search_concepts ──");
const s = await searchConcepts({ query: "how agents waste tokens and cap cost", limit: 5 }, cfg);
console.log(s.status, "·", s.results.length, "hits");
for (const h of s.results) console.log(`  ${h.similarity_score}  ${h.slug} — ${h.title}`);

console.log("\n── get_article ──");
const slug = c.results[0]?.from_slug ?? s.results[0]?.slug;
if (slug) {
  const a = await getArticle({ slug }, cfg);
  console.log(`${a.status} · ${slug} · out=${a.wikilinks_out?.length} in=${a.wikilinks_in?.length} fm=[${Object.keys(a.frontmatter ?? {}).join(",")}]`);
}

console.log("\n✓ smoke complete");
