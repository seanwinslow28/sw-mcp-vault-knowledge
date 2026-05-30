/**
 * Query embedding via Transformers.js (JS-native, ONNX) — no Python, no Ollama.
 * Zero-friction `npm install` for an evaluator is the whole point.
 *
 * Parity with the stored vectors:
 *   - Model family: nomic-embed-text-v1.5 (768-dim), matching vault_indexer.py.
 *   - The indexer embeds RAW text (no `search_document:` prefix) and does not
 *     L2-normalize, so we embed the query raw too and compute true cosine
 *     (dot / (‖a‖·‖b‖)) — never assume unit vectors.
 *   - Live-vault note: stored vectors came from Ollama's nomic GGUF; the query
 *     vector here comes from the HF ONNX build. Same family, near-identical
 *     space — robust for top-k ranking. The public demo vault is re-embedded
 *     with THIS model, so the recruiter path is exact-parity.
 *
 * The model downloads once on first use (cached by Transformers.js). All progress
 * logging goes to stderr — stdout is the JSON-RPC channel.
 */
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBEDDING_MODEL = "nomic-ai/nomic-embed-text-v1.5";
export const EMBEDDING_DIM = 768;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    // Cast through unknown: the pipeline() overload set otherwise produces a
    // union type too complex for tsc to represent (TS2590).
    extractorPromise = pipeline("feature-extraction", EMBEDDING_MODEL, {
      // Quantized weights keep the first-run download small and inference fast.
      dtype: "q8",
    }) as unknown as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

/** Embed a single query string into a 768-dim Float32Array (raw, un-normalized). */
export async function embedQuery(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: false });
  return output.data as Float32Array;
}

/** Decode a raw little-endian float32 BLOB (as written by vault_indexer.py). */
export function blobToVector(blob: Buffer | Uint8Array): Float32Array {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  // Copy into an aligned buffer so Float32Array view is valid regardless of offset.
  const aligned = new Uint8Array(buf.byteLength);
  aligned.set(buf);
  return new Float32Array(aligned.buffer, 0, Math.floor(buf.byteLength / 4));
}

/** True cosine similarity — divides out both norms (vectors are not pre-normalized). */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
