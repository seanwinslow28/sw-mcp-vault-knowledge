# LinkedIn Draft — vault-knowledge-mcp

Sean sends this personally. Dialed ~75% (Domestic Observer + Vonnegut flat collision). No "hire me" — the work is the pitch. Tag Anthropic; link the repo + Loom.

---

Most knowledge tools can search. Almost none can tell you where you disagree with yourself.

I shipped my second MCP server this week — `vault-knowledge-mcp`. It wraps the knowledge graph my note-taking fleet builds every night: ~15,000 notes, with typed edges drawn between them. Six relation types, including the one nobody bothers to represent — `contradicts`.

So I can open Claude Desktop and ask my own vault, out loud, where my engineering decisions argue with each other. It returns real pairs. Last month it caught me championing one research approach in one note and quietly trashing it in another. The machine had read everything I'd written and, unlike me, remembered all of it.

The first MCP I shipped wrapped a skill. This one wraps a graph. Same protocol, completely different shape — which is the entire point. One is a project. Two is a primitive.

It's read-only, runs locally, needs no auth, and ships with a synthetic demo vault — so you can `npx` it in one line and interrogate espresso brewing methods instead of my anxieties.

Repo and a 90-second demo below. Built on @Anthropic's Model Context Protocol.

---

**Posting notes**
- Tag: @Anthropic. Optionally the MCP DevRel folks if you have a specific handle.
- First comment (not the post body): drop the npm + GitHub links there so the post itself stays clean and the algorithm doesn't bury it for an outbound link.
- Image/video: the 90-second Loom, or a single screenshot of `find_contradictions` returning real pairs.
- Alt opener if you want it punchier: *"I built a tool that fact-checks me against myself."*
