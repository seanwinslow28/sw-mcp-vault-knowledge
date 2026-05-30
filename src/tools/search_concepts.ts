/**
 * search_concepts — semantic search over knowledge/{concepts,connections,qa}.
 *
 * Phase 2 fills the body: embed `query` with nomic-embed-text-v1.5 via
 * Transformers.js (same 768-dim space as the stored vectors), cosine-rank
 * against chunks under the allowlist, return top `limit`.
 */
import { z } from "zod";
import type { ServerConfig } from "../config.js";
import { type SearchConceptsResult, VAULT_EMPTY_MESSAGE } from "../types.js";

export const SEARCH_INPUT_SHAPE = {
  query: z.string().min(1).describe("Natural-language query to search concept articles for."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Maximum number of results to return (default 5)."),
} as const;

export const SearchConceptsInputSchema = z.object(SEARCH_INPUT_SHAPE);
export type SearchConceptsInput = z.infer<typeof SearchConceptsInputSchema>;

export async function searchConcepts(
  args: SearchConceptsInput,
  _cfg: ServerConfig,
): Promise<SearchConceptsResult> {
  // Phase 1 scaffold: contract is live, ranking lands in Phase 2.
  return {
    status: "vault-empty",
    query: args.query,
    results: [],
    message: VAULT_EMPTY_MESSAGE,
  };
}
