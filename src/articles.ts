/**
 * Article helpers: slug→path resolution (allowlist-guarded), frontmatter split,
 * title extraction, and [[wikilink]] parsing. No external YAML dep — a light,
 * predictable scalar/inline-array parse is enough for what the tools return.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { isPathAllowed, READABLE_SUBDIRS, type ServerConfig } from "./config.js";

export interface SplitArticle {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Resolve a slug to an absolute file path under the allowlist, or null.
 * Tries each readable subdir in order. Every candidate is checked with
 * isPathAllowed so a slug like "../../secrets" can never escape the boundary.
 */
export function resolveSlugToPath(slug: string, cfg: ServerConfig): string | null {
  for (const sub of READABLE_SUBDIRS) {
    const candidate = resolve(cfg.knowledgeDir, sub, `${slug}.md`);
    if (isPathAllowed(candidate, cfg) && existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Split leading `--- ... ---` frontmatter from the body. */
export function splitFrontmatter(raw: string): SplitArticle {
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    if (end !== -1) {
      const fmText = raw.slice(3, end).trim();
      const body = raw.slice(end + 4).replace(/^\s*\n/, "");
      return { frontmatter: parseScalarYaml(fmText), body };
    }
  }
  return { frontmatter: {}, body: raw };
}

/** Minimal YAML: top-level `key: value` scalars and `[a, b]` inline arrays. */
function parseScalarYaml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val === "") continue;
    if (val.startsWith("[") && val.endsWith("]")) {
      out[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      out[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

/** First `# Heading`, else frontmatter `title:`, else the slug. */
export function extractTitle(
  frontmatter: Record<string, unknown>,
  body: string,
  slug: string,
): string {
  const h1 = /^#\s+(.+)$/m.exec(body);
  if (h1) return h1[1].trim();
  if (typeof frontmatter.title === "string") return frontmatter.title;
  return slug;
}

/** Parse outbound `[[wikilinks]]`, normalizing `[[target|alias]]` → `target`. */
export function extractWikilinksOut(body: string): string[] {
  const seen = new Set<string>();
  const re = /\[\[([^\]]+?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const target = m[1].split("|")[0].split("#")[0].trim();
    if (target) seen.add(target);
  }
  return [...seen];
}

/** A short excerpt for search results: first non-heading, non-empty prose line(s). */
export function makeExcerpt(text: string, maxLen = 240): string {
  const cleaned = text
    .replace(/^---[\s\S]*?\n---\s*/, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen - 1).trimEnd() + "…" : cleaned;
}

/** Read a file's text, or null if unreadable. */
export function readArticleFile(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** slug from an absolute or relative path: basename without `.md`. */
export function slugFromPath(path: string): string {
  return basename(path).replace(/\.md$/, "");
}
