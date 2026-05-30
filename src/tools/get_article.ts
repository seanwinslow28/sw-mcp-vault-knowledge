/**
 * get_article — return one article by slug, with frontmatter, body, and
 * resolved wikilinks (outbound parsed from the body; inbound from the edge graph).
 *
 * Phase 2 fills the body: map slug -> file under an allowlist root (refusing any
 * path that escapes it via isPathAllowed), read + split frontmatter, parse
 * [[wikilinks]] out, query concept_edges for inbound references.
 */
import { z } from "zod";
import type { ServerConfig } from "../config.js";
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
  _cfg: ServerConfig,
): Promise<ArticleResult> {
  // Phase 1 scaffold: contract is live, file resolution lands in Phase 2.
  return {
    status: "not-found",
    slug: args.slug,
    message: `Article '${args.slug}' not found under the configured knowledge directory.`,
  };
}
