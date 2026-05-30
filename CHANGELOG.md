# Changelog

All notable changes to `@swins/vault-knowledge-mcp`.

## [Unreleased]

### Phase 1 — Scaffold (2026-05-30)
- Scaffolded from the `sw-mcp-intent-engineering` skeleton: same SDK pin
  (`@modelcontextprotocol/sdk` 1.29.0), same stdio entry, same `npx` bin shape,
  same `server.json` registry contract. Publish flow reuses the frozen reference
  in `2026-05-06-unified-roadmap.md` § "Publish + registry flow" — DNS-verified
  `com.seanwinslow/*` namespace + existing Ed25519 key. Goal: no surprises
  relative to the first MCP (success criterion #10).
- **Naming decision (locked):** second tool stays `find_contradictions`, not
  `analyze_reasoning_edges`. Rationale: better LLM routing, sharper Loom moment,
  and coherence with already-shipped artifacts (SCORECARD, the
  VAULT_AS_AGENT_INFRASTRUCTURE essay, the fixture README) that all narrate the
  demo as "find contradictions." The "graph-traversal engine" enterprise signal
  the research wanted is carried in the README/EXPLANATION/Loom prose instead.
- 3-tool surface locked (hard cap): `search_concepts`, `find_contradictions`,
  `get_article`. Extras deferred to v0.2.
- Read-only by construction: `better-sqlite3` opened `readonly` + `query_only`
  pragma; zero write surface against the vault.
- Privacy boundary is config-only (env vars + resolved absolute-path allowlist
  over `knowledge/{concepts,connections,qa}`); never a request parameter.
- Embedding strategy locked: nomic-embed-text-v1.5 via Transformers.js (ONNX),
  matching the stored 768-dim vectors so `search_concepts` can cosine-rank
  directly against the existing `.vault-index.db` (read-only, no second index).

### Phase 2 — Tool implementations (2026-05-30)
- **SQLite driver decision (changed from spec §3c):** swapped `better-sqlite3`
  for Node's built-in `node:sqlite` (`DatabaseSync`, Node ≥ 22.5). Rationale:
  better-sqlite3 needs native compilation / prebuilds (node-gyp), a real
  install-friction risk that directly undercuts the locked "zero-friction
  `npm install` for a recruiter" north star. node:sqlite is zero-dependency,
  zero-build, and read-only enforced at the engine. The driver was never a
  locked decision (spec flagged the stack "open for research challenge").
  `engines.node` bumped to `>=22.5.0`; better-sqlite3 + its types removed.
- node:sqlite emits a one-time ExperimentalWarning; loaded via dynamic import
  after an stderr-warning suppressor installs (see
  `src/suppress-experimental-warning.ts` + `src/db.ts`), so the stdio
  diagnostics channel stays clean.
- `search_concepts`: embeds the query with nomic-embed-text-v1.5 via
  Transformers.js (raw text, no prefix — matching vault_indexer.py), cosine-ranks
  against the stored 768-dim vectors, filtered to the allowlisted prefixes only
  (knowledge/{concepts,connections,qa}); expansions/ and 40_knowledge/ are in the
  DB but never returned. Grouped by file → best chunk per article.
- `find_contradictions`: `relation='contradicts' AND valid_until IS NULL`, with
  a `recent_30d` ISO-cutoff filter on created_at. Verified against the live vault
  (30 active edges) and a synthetic fixture (active vs retired vs non-contradiction).
- `get_article`: allowlist-guarded slug→path resolution (traversal-proof),
  frontmatter split, outbound `[[wikilink]]` parse, inbound links from
  concept_edges.to_slug. Verified live (frontmatter + in/out links resolve).
- Empty-state honesty on every path (missing DB → vault-empty; missing slug →
  not-found; never a throw, never invented data).
- Tests: 9 hermetic node:test cases (synthetic temp vault + DB) — all pass.
  Live DB tools verified in-session; model-backed search_concepts + MCP Inspector
  pass run on Sean's Mac via `scripts/smoke.mjs` (HF model downloads once).

### Phase 3 — Public demo vault + privacy hardening (2026-05-30)
- Bundled the synthetic espresso fixture into the repo at
  `examples/demo-vault/knowledge/concepts/` (10 notes) + `edges.json` (15 edges,
  all 6 relation types, 2 contradictions). Ships in the npm package (`files`).
- `scripts/build-demo-vault.mjs` builds `examples/demo-vault/demo-index.db`
  mirroring the real schema (chunks + concept_edges + index_meta). Document
  embeddings use the SAME Transformers.js nomic-v1.5 model as the query path, so
  the recruiter's search_concepts is exact-parity (no cross-engine drift).
  `--no-embed` / `DEMO_VAULT_ROOT` flags support CI on a native FS.
- **Zero-config demo mode:** with neither VAULT_DB nor VAULT_ROOT set, the server
  serves the bundled demo vault — `npx @swins/vault-knowledge-mcp` works out of
  the box. Setting one env var without the other fails loudly (misconfig guard).
- Privacy boundary hardened + tested: a battery of malicious slugs (absolute
  paths, `../` traversal, URL-encoded, out-of-scope `expansions/` and `health/`)
  are all refused. Demo verified: find_contradictions → the 2 expected pairs;
  get_article resolves frontmatter + in/out wikilinks; out-of-scope reads denied.
- Tests: 10 hermetic cases (added the malicious-slug battery + demo-mode config).

### Phase 4 — README + EXPLANATION + Loom + publish (2026-05-30, copy drafted)
- README rewritten to < 200 words of prose with both copy-paste config blocks
  (zero-config demo + own-vault). Voice calibrated ~40%.
- `docs/EXPLANATION.md` — 4Q comprehension artifact (What is this / Why this
  approach / What would break / What did I learn), tuned for a < 90s recruiter
  cold-read. Leads on the node:sqlite driver judgment call and the contradiction-
  as-product thesis; names the cross-engine embedding approximation honestly.
- `docs/LOOM-SCRIPT.md` — 90s spoken script, all 3 tools, contradiction as the
  hook, zero-infra close.
- `docs/LINKEDIN-DRAFT.md` — syndication post (Sean sends), ~75% voice, no
  "hire me" closer per the writing-voice-modes desperation anti-pattern.
- `server.json` description shortened to 98 chars (registry caps at 100).
- Publish (npm + MCP registry) pending — runs on Sean's Mac via the frozen flow.
