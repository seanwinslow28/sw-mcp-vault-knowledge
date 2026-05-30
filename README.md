# vault-knowledge-mcp

> Phase 1 scaffold. Final README (< 200 words, copy-paste `claude_desktop_config.json` block) lands in Phase 4.

A read-only MCP server that turns an Obsidian vault's typed knowledge graph into three queryable tools. Local-first, stdio, no auth, no cloud.

## Tools

- `search_concepts(query, limit=5)` — semantic search over concept/connection/Q&A articles.
- `find_contradictions(scope='all'|'recent_30d')` — active `contradicts` edges from the six-relation reasoning graph.
- `get_article(slug)` — one article with frontmatter, body, and resolved wikilinks.

## Configuration

```bash
VAULT_DB=/abs/path/to/.vault-index.db   # read-only SQLite index
VAULT_ROOT=/abs/path/to/vault           # vault root
VAULT_KNOWLEDGE_DIR=knowledge           # optional; defaults to "knowledge"
```

Only `knowledge/{concepts,connections,qa}` is ever readable. Scope is config-only — never a request parameter.

## License

MIT
