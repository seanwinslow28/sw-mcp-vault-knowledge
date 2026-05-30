/**
 * find_contradictions — surface active `contradicts` edges from the typed
 * reasoning graph. The sharpest edge in a six-relation graph (supports,
 * contradicts, evolved_into, supersedes, depends_on, related_to); this tool
 * traverses the one that makes the best demo.
 *
 * Phase 2 fills the body:
 *   SELECT from_slug, to_slug, confidence, created_at, source_synth_run
 *   FROM concept_edges
 *   WHERE relation = 'contradicts' AND valid_until IS NULL
 *   [AND created_at >= datetime('now','-30 days')]   -- scope = recent_30d
 */
import { z } from "zod";
import type { ServerConfig } from "../config.js";
import { type FindContradictionsResult } from "../types.js";

export const CONTRADICTIONS_INPUT_SHAPE = {
  scope: z
    .enum(["all", "recent_30d"])
    .default("all")
    .describe("'all' returns every active contradiction; 'recent_30d' filters to edges surfaced in the last 30 days."),
} as const;

export const FindContradictionsInputSchema = z.object(CONTRADICTIONS_INPUT_SHAPE);
export type FindContradictionsInput = z.infer<typeof FindContradictionsInputSchema>;

export async function findContradictions(
  args: FindContradictionsInput,
  _cfg: ServerConfig,
): Promise<FindContradictionsResult> {
  // Phase 1 scaffold: contract is live, SQL lands in Phase 2.
  return {
    status: "vault-empty",
    scope: args.scope,
    results: [],
    message: "No active contradiction edges found in the reasoning graph yet.",
  };
}
