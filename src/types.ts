/**
 * Shared result shapes + empty-state honesty helpers.
 *
 * Every tool returns a discriminated object with an explicit `status`. When the
 * vault or DB has nothing to return, we say so — we never invent data.
 */

export type ToolStatus = "ok" | "vault-empty" | "not-found";

export interface ConceptHit {
  slug: string;
  title: string;
  similarity_score: number;
  excerpt: string;
  last_modified: string;
}

export interface SearchConceptsResult {
  status: ToolStatus;
  query: string;
  results: ConceptHit[];
  message?: string;
}

export interface ContradictionEdge {
  from_slug: string;
  to_slug: string;
  confidence: number | null;
  surfaced_at: string;
  source_run_id: string;
}

export interface FindContradictionsResult {
  status: ToolStatus;
  scope: "all" | "recent_30d";
  results: ContradictionEdge[];
  message?: string;
}

export interface ArticleResult {
  status: ToolStatus;
  slug: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  wikilinks_out?: string[];
  wikilinks_in?: string[];
  message?: string;
}

/** Standard empty-state payloads — referenced by every tool's no-data path. */
export const VAULT_EMPTY_MESSAGE =
  "No concept articles found under the configured knowledge directory. The synthesizer may not have run yet, or the vault is empty.";
