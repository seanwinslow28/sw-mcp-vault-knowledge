# 90-Second Loom Script — vault-knowledge-mcp

Target: 90s. ~210 spoken words. Record in Claude Desktop with the server already connected (live vault, not demo, so the contradictions are real). Keep the cursor calm; let the JSON land on screen.

---

**[0:00–0:12] Cold open**
*[SCREEN: Claude Desktop, Settings → Developer showing `vault-knowledge` running.]*

> This is my second MCP server. The first one wrapped a skill. This one wraps my vault's knowledge graph — about fifteen thousand notes, with typed edges between them. Three tools, read-only.

**[0:12–0:38] find_contradictions — the moment**
*[SCREEN: type into chat.]*

> Watch this. *"Find contradictions in my engineering decisions from the last month."*

*[Claude calls `find_contradictions(scope: 'recent_30d')`; ~30 edges return.]*

> These aren't keyword matches. A pipeline I run every night reads my notes and flags where they actually disagree with each other. Local-deep-research versus Gemini deep research. Most knowledge tools can search. Almost none can tell you where you contradicted yourself.

**[0:38–0:58] get_article — read the source**
*[SCREEN: ask Claude to pull one side.]*

> I can pull either side and read why. *"Get the article on the first one."*

*[Claude calls `get_article`; frontmatter, body, and inbound/outbound links render.]*

> Frontmatter, the body, and the links in and out of the graph. The contradiction is traceable to the note that surfaced it.

**[0:58–1:18] search_concepts — semantic search**
*[SCREEN: type.]*

> And plain search, when I want it. *"How do my agents waste tokens?"*

*[Claude calls `search_concepts`; five ranked hits, descending similarity.]*

> Ranked by meaning, not keywords — the token-waste cluster, top of the list.

**[1:18–1:30] Close**
*[SCREEN: the README config block.]*

> Zero infrastructure on my end. Read-only. No auth. It ships with a synthetic demo vault, so you can install it with one `npx` line and ask it the same questions about espresso. The graph my scorecard measures — now queryable from your machine.
