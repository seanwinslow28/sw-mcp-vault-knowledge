# vault-knowledge-mcp

A read-only MCP server that turns an Obsidian vault's typed knowledge graph into three tools any MCP client can call. Most knowledge tools can search. Few can tell you where your own notes disagree with each other. This one traverses a six-relation reasoning graph and surfaces the sharpest edge — `contradicts`. Local-first, stdio, no auth, no cloud, no native build.

The full reasoning lives in [`docs/EXPLANATION.md`](docs/EXPLANATION.md).

## Tools

| Tool | Returns |
|---|---|
| `search_concepts(query, limit=5)` | Semantically ranked concept/connection articles. |
| `find_contradictions(scope='all'\|'recent_30d')` | Active `contradicts` edges from the reasoning graph. |
| `get_article(slug)` | One article with frontmatter, body, and resolved wikilinks. |

## Try it — zero config

Ships with a synthetic espresso vault, so it works the moment it installs.

```json
{
  "mcpServers": {
    "vault-knowledge": { "command": "npx", "args": ["-y", "@swins/vault-knowledge-mcp"] }
  }
}
```

Then ask: *"find contradictions in the vault."*

## Point it at your own vault

```json
{
  "mcpServers": {
    "vault-knowledge": {
      "command": "npx",
      "args": ["-y", "@swins/vault-knowledge-mcp"],
      "env": {
        "VAULT_DB": "/abs/path/.vault-index.db",
        "VAULT_ROOT": "/abs/path/vault"
      }
    }
  }
}
```

Only `knowledge/{concepts,connections,qa}` is ever readable. Scope is config-only — never a request parameter, so a client can't widen it.

## Requirements

Node ≥ 22.5 (built-in `node:sqlite`). `search_concepts` downloads the nomic-embed-text-v1.5 model once on first run.

## License

MIT.
