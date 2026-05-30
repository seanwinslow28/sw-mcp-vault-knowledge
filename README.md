# vault-knowledge-mcp

> Phase 1–3 scaffold. The final < 200-word pitch lands in Phase 4.

A read-only MCP server that turns an Obsidian vault's typed knowledge graph into three queryable tools. Local-first, stdio, no auth, no cloud, no native build.

## Tools

- `search_concepts(query, limit=5)` — semantic search over concept/connection/Q&A articles.
- `find_contradictions(scope='all'|'recent_30d')` — active `contradicts` edges from the six-relation reasoning graph.
- `get_article(slug)` — one article with frontmatter, body, and resolved wikilinks.

## Try it with zero config (bundled demo vault)

With no environment set, the server serves a bundled, fully-synthetic espresso vault — so it works the moment it's installed.

```json
{
  "mcpServers": {
    "vault-knowledge": {
      "command": "npx",
      "args": ["-y", "@swins/vault-knowledge-mcp"]
    }
  }
}
```

Then ask: *"find contradictions in the vault"* → returns `water-chemistry ⨯ pump-pressure` and `pre-infusion ⨯ tamping`.

## Point it at your own vault

Set both env vars (one without the other fails loudly):

```json
{
  "mcpServers": {
    "vault-knowledge": {
      "command": "npx",
      "args": ["-y", "@swins/vault-knowledge-mcp"],
      "env": {
        "VAULT_DB": "/abs/path/to/.vault-index.db",
        "VAULT_ROOT": "/abs/path/to/vault"
      }
    }
  }
}
```

Only `knowledge/{concepts,connections,qa}` is ever readable (`VAULT_KNOWLEDGE_DIR` defaults to `knowledge`). Scope is config-only — never a request parameter, so a client can't widen it.

## Requirements

Node ≥ 22.5 (uses the built-in `node:sqlite`). `search_concepts` downloads the nomic-embed-text-v1.5 model once on first use.

## License

MIT
