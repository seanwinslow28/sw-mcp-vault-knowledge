/**
 * search_concepts — semantic search over knowledge/{concepts,connections,qa}.
 *
 * Ranks the query against the stored 768-dim nomic vectors already in the
 * read-only index, filtered to the allowlisted prefixes only (expansions/ and
 * 40_knowledge/ are in the DB but out of scope and never returned). Grouped by
 * file: each article scores by its best-matching chunk.
 */
import { z } from "zod";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import type { ServerConfig } from "../config.js";
import { READABLE_SUBDIRS } from "../config.js";
import { openReadOnly } from "../db.js";
import { blobToVector, cosineSimilarity, embedQuery } from "../embeddings.js";
import {
  extractTitle,
  makeExcerpt,
  readArticleFile,
  slugFromPath,
  splitFrontmatter,
} from "../articles.js";
import { type ConceptHit, type SearchConceptsResult, VAULT_EMPTY_MESSAGE } from "../types.js";

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

interface ChunkRow {
  file_path: string;
  chunk_text: string;
  embedding: Buffer;
  file_mtime: number;
}

export async function searchConcepts(
  args: SearchConceptsInput,
  cfg: ServerConfig,
): Promise<SearchConceptsResult> {
  const { db, missing } = await openReadOnly(cfg);
  if (missing || !db) {
    return { status: "vault-empty", query: args.query, results: [], message: VAULT_EMPTY_MESSAGE };
  }

  try {
    // Allowlist filter, built from the vault-root-relative knowledge prefix.
    const likeClauses = READABLE_SUBDIRS.map(() => "file_path LIKE ?").join(" OR ");
    const likeParams = READABLE_SUBDIRS.map((sub) => `${cfg.knowledgeRel}/${sub}/%`);
    const rows = db
      .prepare(
        `SELECT file_path, chunk_text, embedding, file_mtime
           FROM chunks
          WHERE embedding IS NOT NULL AND (${likeClauses})`,
      )
      .all(...likeParams) as unknown as ChunkRow[];

    if (rows.length === 0) {
      return { status: "vault-empty", query: args.query, results: [], message: VAULT_EMPTY_MESSAGE };
    }

    const queryVec = await embedQuery(args.query);

    // Best chunk per file.
    const best = new Map<string, { score: number; text: string; mtime: number }>();
    for (const r of rows) {
      const score = cosineSimilarity(queryVec, blobToVector(r.embedding));
      const prev = best.get(r.file_path);
      if (!prev || score > prev.score) {
        best.set(r.file_path, { score, text: r.chunk_text, mtime: r.file_mtime });
      }
    }

    const ranked = [...best.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, args.limit);

    const results: ConceptHit[] = ranked.map(([filePath, hit]) => {
      const slug = slugFromPath(filePath);
      const abs = resolve(cfg.vaultRoot, filePath);
      const raw = readArticleFile(abs);
      const { frontmatter, body } = raw ? splitFrontmatter(raw) : { frontmatter: {}, body: "" };
      let lastModified: string;
      try {
        lastModified = statSync(abs).mtime.toISOString();
      } catch {
        lastModified = new Date(hit.mtime * 1000).toISOString();
      }
      return {
        slug,
        title: raw ? extractTitle(frontmatter, body, slug) : slug,
        similarity_score: Number(hit.score.toFixed(4)),
        excerpt: makeExcerpt(hit.text),
        last_modified: lastModified,
      };
    });

    return { status: "ok", query: args.query, results };
  } finally {
    db.close();
  }
}
