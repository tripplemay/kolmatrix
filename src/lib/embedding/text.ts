/**
 * B7a-F001 · Embedding source-text builders.
 *
 * Pre-impl audit lock #4 #5 (2026-04-28):
 *   KOL text  = displayName + bio + categories + tags + countryCode + language
 *   Product   = name + category + targetAudience + uniqueSellingPoints
 *
 * Why concatenated multi-field rather than just `bio`:
 *   ~30% of YouTube KOLs have NULL bio; a concatenated string lets
 *   bge-m3 (multilingual) work off displayName + categories + tags
 *   even when bio is missing. Average ~50 tokens, batch cost
 *   negligible (~$0.0042 per 1K KOL).
 *
 * The output is intentionally a single line (newlines normalised to
 * spaces) so downstream hash + token-count behaviour is stable.
 */
import { createHash } from "node:crypto";

/** Inputs needed to compose a KOL row's embedding text. */
export interface KolEmbedInput {
  displayName: string;
  bio: string | null | undefined;
  categories: readonly string[] | null | undefined;
  tags: readonly string[] | null | undefined;
  countryCode: string | null | undefined;
  language: string | null | undefined;
}

/** Inputs needed to compose a Product row's embedding text. */
export interface ProductEmbedInput {
  name: string;
  category: string;
  targetAudience: string | null | undefined;
  uniqueSellingPoints: string;
}

const SEP = " | ";

function clean(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

function joinList(arr: readonly string[] | null | undefined): string {
  if (!arr || arr.length === 0) return "";
  return arr.map(clean).filter(Boolean).join(", ");
}

/**
 * Build the embedding source text for one KOL.
 *
 * Returns "" when there's nothing meaningful to embed (e.g. all fields
 * empty); callers should skip such rows rather than burn tokens on a
 * useless vector.
 */
export function buildKolEmbedText(input: KolEmbedInput): string {
  const parts: string[] = [];
  const name = clean(input.displayName);
  if (name) parts.push(`name: ${name}`);

  const bio = clean(input.bio);
  if (bio) parts.push(`bio: ${bio}`);

  const cats = joinList(input.categories);
  if (cats) parts.push(`categories: ${cats}`);

  const tags = joinList(input.tags);
  if (tags) parts.push(`tags: ${tags}`);

  const country = clean(input.countryCode);
  if (country) parts.push(`country: ${country}`);

  const lang = clean(input.language);
  if (lang) parts.push(`language: ${lang}`);

  return parts.join(SEP);
}

/** Build the embedding source text for one Product. */
export function buildProductEmbedText(input: ProductEmbedInput): string {
  const parts: string[] = [];
  const name = clean(input.name);
  if (name) parts.push(`name: ${name}`);

  const category = clean(input.category);
  if (category) parts.push(`category: ${category}`);

  const audience = clean(input.targetAudience);
  if (audience) parts.push(`audience: ${audience}`);

  const usp = clean(input.uniqueSellingPoints);
  if (usp) parts.push(`selling points: ${usp}`);

  return parts.join(SEP);
}

/**
 * Stable SHA-256 hash of the source text. Used by the B6 daily-sync
 * hook (decision #6:B') to skip re-embedding rows whose source text is
 * unchanged since the last embed call.
 *
 * The hash is short (16 hex chars = 64 bits) — collision risk is
 * negligible at our scale (≤ 100K rows) and the column stays compact.
 */
export function hashEmbeddingText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}
