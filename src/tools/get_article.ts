/**
 * get_article — return one article by slug with frontmatter, body, and resolved
 * wikilinks. Outbound links are parsed from the body; inbound links come from
 * the edge graph (concept_edges.to_slug = slug). Reads only files under the
 * allowlist — a traversal slug can never escape it.
 */
import { z } from "zod";
import type { ServerConfig } from "../config.js";
import { openReadOnly } from "../db.js";
import {
  extractWikilinksOut,
  readArticleFile,
  resolveSlugToPath,
  splitFrontmatter,
} from "../articles.js";
import { type ArticleResult } from "../types.js";

export const ARTICLE_INPUT_SHAPE = {
  slug: z
    .string()
    .min(1)
    .describe("Slug of the article to fetch (filename without extension, e.g. 'pre-infusion')."),
} as const;

export const GetArticleInputSchema = z.object(ARTICLE_INPUT_SHAPE);
export type GetArticleInput = z.infer<typeof GetArticleInputSchema>;

export async function getArticle(
  args: GetArticleInput,
  cfg: ServerConfig,
): Promise<ArticleResult> {
  const path = resolveSlugToPath(args.slug, cfg);
  if (!path) {
    return {
      status: "not-found",
      slug: args.slug,
      message: `Article '${args.slug}' not found under the configured knowledge directory.`,
    };
  }

  const raw = readArticleFile(path);
  if (raw === null) {
    return {
      status: "not-found",
      slug: args.slug,
      message: `Article '${args.slug}' could not be read.`,
    };
  }

  const { frontmatter, body } = splitFrontmatter(raw);
  const wikilinksOut = extractWikilinksOut(body);

  // Inbound references from the reasoning graph (best-effort; DB may be absent).
  let wikilinksIn: string[] = [];
  const { db, missing } = await openReadOnly(cfg);
  if (db && !missing) {
    try {
      const tableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='concept_edges'")
        .get();
      if (tableExists) {
        const rows = db
          .prepare(
            "SELECT DISTINCT from_slug FROM concept_edges WHERE to_slug = ? AND valid_until IS NULL",
          )
          .all(args.slug) as unknown as { from_slug: string }[];
        wikilinksIn = rows.map((r) => r.from_slug);
      }
    } finally {
      db.close();
    }
  }

  return {
    status: "ok",
    slug: args.slug,
    frontmatter,
    body,
    wikilinks_out: wikilinksOut,
    wikilinks_in: wikilinksIn,
  };
}
