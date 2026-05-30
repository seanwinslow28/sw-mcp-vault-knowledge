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

### Phase 2 — Tool implementations (pending)
### Phase 3 — Public demo vault + privacy hardening (pending)
### Phase 4 — README + EXPLANATION + Loom + publish (pending)
