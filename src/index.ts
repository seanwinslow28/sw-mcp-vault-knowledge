#!/usr/bin/env node
/**
 * vault-knowledge-mcp — read-only MCP server over a typed knowledge graph.
 *
 * Transport: stdio (no HTTP, no auth, no SaaS).
 * Three tools, hard cap: search_concepts, find_contradictions, get_article.
 *
 * NOTE: stdio uses stdout for the JSON-RPC channel. Never console.log here —
 * diagnostics go to stderr (console.error). prepublishOnly enforces this.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig, type ServerConfig } from "./config.js";
import {
  SEARCH_INPUT_SHAPE,
  SearchConceptsInputSchema,
  searchConcepts,
} from "./tools/search_concepts.js";
import {
  CONTRADICTIONS_INPUT_SHAPE,
  FindContradictionsInputSchema,
  findContradictions,
} from "./tools/find_contradictions.js";
import {
  ARTICLE_INPUT_SHAPE,
  GetArticleInputSchema,
  getArticle,
} from "./tools/get_article.js";

// Resolve config once at startup. Tolerate absence so `tools/list` works for an
// evaluator who hasn't set env yet; tool *calls* then report the config error.
let config: ServerConfig | null = null;
let configError: string | null = null;
try {
  config = loadConfig();
} catch (e) {
  configError = e instanceof Error ? e.message : String(e);
}

function requireConfig(): ServerConfig {
  if (!config) {
    throw new Error(
      `Server not configured: ${configError ?? "set VAULT_DB and VAULT_ROOT."}`,
    );
  }
  return config;
}

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function fail(tool: string, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return {
    isError: true,
    content: [{ type: "text" as const, text: `${tool} error: ${msg}` }],
  };
}

const server = new McpServer({
  name: "vault-knowledge",
  version: "0.1.0",
});

server.registerTool(
  "search_concepts",
  {
    title: "Search Concepts",
    description:
      "Semantically search the vault's concept, connection, and Q&A articles for a natural-language query. Returns ranked {slug, title, similarity_score, excerpt, last_modified}. Read-only.",
    inputSchema: SEARCH_INPUT_SHAPE,
  },
  async (rawArgs) => {
    try {
      const args = SearchConceptsInputSchema.parse(rawArgs);
      return ok(await searchConcepts(args, requireConfig()));
    } catch (e) {
      return fail("search_concepts", e);
    }
  },
);

server.registerTool(
  "find_contradictions",
  {
    title: "Find Contradictions",
    description:
      "Traverse the typed reasoning graph for active 'contradicts' edges — the sharpest of six relation types. scope='all' or 'recent_30d'. Returns {from_slug, to_slug, confidence, surfaced_at, source_run_id}. Read-only.",
    inputSchema: CONTRADICTIONS_INPUT_SHAPE,
  },
  async (rawArgs) => {
    try {
      const args = FindContradictionsInputSchema.parse(rawArgs);
      return ok(await findContradictions(args, requireConfig()));
    } catch (e) {
      return fail("find_contradictions", e);
    }
  },
);

server.registerTool(
  "get_article",
  {
    title: "Get Article",
    description:
      "Fetch one article by slug with frontmatter, body, and resolved inbound/outbound wikilinks. Reads only files under the configured knowledge allowlist. Read-only.",
    inputSchema: ARTICLE_INPUT_SHAPE,
  },
  async (rawArgs) => {
    try {
      const args = GetArticleInputSchema.parse(rawArgs);
      return ok(await getArticle(args, requireConfig()));
    } catch (e) {
      return fail("get_article", e);
    }
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("vault-knowledge MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting vault-knowledge MCP server:", err);
  process.exit(1);
});
