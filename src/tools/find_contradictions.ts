/**
 * find_contradictions — surface active `contradicts` edges from the typed
 * reasoning graph. The sharpest of six relations (supports, contradicts,
 * evolved_into, supersedes, depends_on, related_to); this tool traverses the
 * one that makes the best demo.
 *
 *   SELECT from_slug, to_slug, confidence, created_at, source_synth_run
 *   FROM concept_edges
 *   WHERE relation = 'contradicts' AND valid_until IS NULL
 *   [AND created_at >= :cutoff]   -- scope = recent_30d
 */
import { z } from "zod";
import type { ServerConfig } from "../config.js";
import { openReadOnly } from "../db.js";
import { type ContradictionEdge, type FindContradictionsResult } from "../types.js";

export const CONTRADICTIONS_INPUT_SHAPE = {
  scope: z
    .enum(["all", "recent_30d"])
    .default("all")
    .describe(
      "'all' returns every active contradiction; 'recent_30d' filters to edges surfaced in the last 30 days.",
    ),
} as const;

export const FindContradictionsInputSchema = z.object(CONTRADICTIONS_INPUT_SHAPE);
export type FindContradictionsInput = z.infer<typeof FindContradictionsInputSchema>;

interface EdgeRow {
  from_slug: string;
  to_slug: string;
  confidence: number | null;
  created_at: string;
  source_synth_run: string;
}

const VAULT_EMPTY = "No reasoning graph found (concept_edges table is empty or absent).";

export async function findContradictions(
  args: FindContradictionsInput,
  cfg: ServerConfig,
): Promise<FindContradictionsResult> {
  const { db, missing } = await openReadOnly(cfg);
  if (missing || !db) {
    return { status: "vault-empty", scope: args.scope, results: [], message: VAULT_EMPTY };
  }

  try {
    // Guard: if the table doesn't exist (blank db), this is a clean empty-state.
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='concept_edges'")
      .get();
    if (!tableExists) {
      return { status: "vault-empty", scope: args.scope, results: [], message: VAULT_EMPTY };
    }

    let sql =
      `SELECT from_slug, to_slug, confidence, created_at, source_synth_run
         FROM concept_edges
        WHERE relation = 'contradicts' AND valid_until IS NULL`;
    const params: string[] = [];
    if (args.scope === "recent_30d") {
      // Stored created_at uses ISO 'YYYY-MM-DDTHH:MM:SS'; build a matching cutoff.
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d+Z$/, "");
      sql += " AND created_at >= ?";
      params.push(cutoff);
    }
    sql += " ORDER BY created_at DESC";

    const rows = db.prepare(sql).all(...params) as unknown as EdgeRow[];

    const results: ContradictionEdge[] = rows.map((r) => ({
      from_slug: r.from_slug,
      to_slug: r.to_slug,
      confidence: r.confidence,
      surfaced_at: r.created_at,
      source_run_id: r.source_synth_run,
    }));

    return {
      status: "ok",
      scope: args.scope,
      results,
      ...(results.length === 0
        ? { message: `No active contradiction edges found (scope='${args.scope}').` }
        : {}),
    };
  } finally {
    db.close();
  }
}
