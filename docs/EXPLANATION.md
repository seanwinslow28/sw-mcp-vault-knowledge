# EXPLANATION.md

A 4Q comprehension artifact for the `vault-knowledge-mcp` server. The 4Q framework (Nate B. Jones) is the explanation artifact of the generative era — a commit message optimized for "does this person understand what they shipped?" instead of "did the bytes change?"

---

## What is this?

An MCP server that exposes three read-only tools — `search_concepts`, `find_contradictions`, `get_article` — over the standard Model Context Protocol. Any MCP-aware client (Claude Desktop, Cursor, Anti-Gravity) can call them against an Obsidian vault's knowledge graph.

The graph isn't new. A nightly synthesizer in my personal Claude Code fleet writes typed edges between concept notes — six relations: `supports`, `contradicts`, `evolved_into`, `supersedes`, `depends_on`, `related_to` — into a SQLite index alongside ~15k embedded chunks. I already score that graph in a separate scorecard and essay. This server is the part those docs couldn't be: the live surface. A recruiter can install it and ask my vault where it disagrees with itself, in under a minute, from their own machine.

This is my second MCP. The first (`intent-engineering`) wrapped a *skill*. This one wraps a *knowledge graph*. Same protocol, different shape — which is the point. One MCP is a project. Two of different shapes is a primitive you understand.

---

## Why this approach?

**Why read-only against the existing index, not a new one.** The vault's nightly pipeline already maintains the embeddings and edges. A second index would double the cost and drift out of sync. The server opens the existing `.vault-index.db` in read-only mode and computes cosine similarity in process — it sees every nightly update for free and can never corrupt the source.

**Why `node:sqlite` over better-sqlite3.** This is the decision I'd defend hardest. The obvious pick was `better-sqlite3`. It needs native compilation and prebuilt binaries — and it failed to install twice on a clean machine during the build. The whole reason this artifact exists is that a recruiter can `npx` it with zero friction; a tool that fails `npm install` defeats its own purpose. Node 22.5 ships a built-in SQLite module. Zero dependencies, zero build step, read-only enforced at the engine. I swapped the driver mid-build. The cost is a Node ≥22.5 floor, which is a fair trade for "it just installs."

**Why JS-native embeddings.** `search_concepts` embeds the query with nomic-embed-text-v1.5 via Transformers.js — same model family as the stored vectors, running in Node. The alternative was a Python sidecar calling Ollama, which reintroduces exactly the install friction the driver decision removed.

**Why three tools, hard cap.** Search, traverse, retrieve. The graph has six relations, so `query_edges(relation)` was tempting — but a tool surface a recruiter can learn in 60 seconds beats one that's technically complete. `find_contradictions` names the most valuable verb directly. The other five relations wait for v0.2.

**Why stdio, MIT, domain-verified namespace.** Local demo, no infra, no auth surface; same publish flow as `intent-engineering`, no surprises.

---

## What would break?

**1. Cross-engine embedding drift.** The stored vectors came from Ollama's nomic GGUF; the query vector comes from the Transformers.js ONNX build. Same family, near-identical space — and live ranking is correct (a "token waste" query returns the token-waste cluster, descending). But it's an approximation, named honestly. The bundled demo vault is re-embedded with the *same* JS model, so the recruiter's path is exact-parity.

**2. Edges whose endpoints aren't articles.** A few `contradicts` edges point at slugs with no concept file (a pruned note, a connection). `get_article` returns a clean `not-found` there — but a naive demo that assumes every edge endpoint is retrievable would hit empty reads. By design, not a crash.

**3. Heading/dir coupling.** The server reads `knowledge/{concepts,connections,qa}` and nothing else. `qa` is currently empty, so search over it returns clean empty-state. Point it at a vault laid out differently and `VAULT_KNOWLEDGE_DIR` covers the rename — but the three-subdir shape is a v0 assumption.

---

## What did I learn?

**Privacy is cleaner as structure than as policy.** The allowlist is config-only — resolved once from env vars, never a request parameter — so a client cannot ask the server to read `health/` or `prj-job-hunt/` no matter how it phrases the call. Read-only at the engine plus a resolved-absolute-path guard means the unsafe operation isn't restricted; it's unrepresentable. That's a stronger guarantee than a blocklist I have to keep updating.

**The contradiction verb is the whole pitch.** Most knowledge tools retrieve what you asked for. The interesting question is where your own thinking conflicts — and that requires typed edges, not just embeddings. I built the edge schema months ago for a nightly pipeline. The MCP didn't add intelligence; it exposed intelligence that was already there. The durable lesson from shipping two MCPs: the protocol is a thin adapter. The value is whatever structured thing you already maintain on the other side of it.
