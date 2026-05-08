/**
 * BL-012-F007 · Shared zod schemas for the apify-kol-service contract.
 *
 * Extracted from `src/lib/admin/apify-preview-client.ts` (F002 fix-round 2)
 * so the Stage 1.5 admin preview path AND the Stage 2 sync adapter
 * (`src/lib/kol-sync/adapters/apify-kol.ts`) can share one source of
 * truth for the fork response shape. v0.9.19 sediment: the audit-time
 * sample only carried plain-string `externalUrls` + record-shaped
 * `aggregatorLinks`, but real fork rows ship `[{url, title, ...}]` for
 * the former and array-of-objects for the latter — both wide variants
 * are pinned by tests and must stay accepted here.
 */
import { z } from "zod";

export const RAW_OBJECT = z.record(z.string(), z.unknown());

/**
 * Single KOL row as returned by the apify-kol-service business read API
 * (`GET /kol`). `passthrough()` keeps any extra fields around for the
 * raw-JSON expand panel + future fields (no contract churn when fork
 * adds a new column).
 */
export const ApifyKolItemSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    platform: z.string(),
    platformUserId: z.string(),
    username: z.string(),
    displayName: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    profileUrl: z.string().nullable().optional(),
    followers: z.number().nullable().optional(),
    following: z.number().nullable().optional(),
    postsCount: z.number().nullable().optional(),
    totalLikes: z.number().nullable().optional(),
    totalViews: z.number().nullable().optional(),
    verified: z.boolean().nullable().optional(),
    isBusinessAccount: z.boolean().nullable().optional(),
    emails: z.array(z.string()).nullable().optional(),
    phones: z.array(z.string()).nullable().optional(),
    telegrams: z.array(z.string()).nullable().optional(),
    discords: z.array(z.string()).nullable().optional(),
    socialHandles: RAW_OBJECT.nullable().optional(),
    externalUrl: z.string().nullable().optional(),
    // Fork actually emits `externalUrls` as objects shaped like
    // `{ url, title?, ... }` (see tikhub-migration-design.md §5.3 — IG
    // bio_links). The audit-time sample only had a plain-string variant,
    // so F002 fix-round 2 widened the schema to a union that accepts
    // either shape — `passthrough()` keeps any extra metadata around
    // for the raw-JSON expand panel.
    externalUrls: z
      .array(
        z.union([
          z.string(),
          z
            .object({
              url: z.string(),
              title: z.string().nullable().optional(),
            })
            .passthrough(),
        ])
      )
      .nullable()
      .optional(),
    aggregatorUrl: z.string().nullable().optional(),
    aggregatorEmails: z.array(z.string()).nullable().optional(),
    // Fork emits `aggregatorLinks` as either a record (Linktree-style
    // map) or an array of objects (other aggregators). Accept either
    // and let the raw-JSON expand panel surface the actual shape.
    aggregatorLinks: z
      .union([RAW_OBJECT, z.array(z.unknown())])
      .nullable()
      .optional(),
    relevanceScore: z.number().nullable().optional(),
    influenceScore: z.number().nullable().optional(),
    qualityScore: z.number().nullable().optional(),
    reachabilityScore: z.number().nullable().optional(),
    matchedTags: z.array(z.string()).nullable().optional(),
    matchedKeywords: z.array(z.string()).nullable().optional(),
    tier: z.string().nullable().optional(),
    isSeed: z.boolean().nullable().optional(),
    lastScrapedAt: z.string().nullable().optional(),
  })
  .passthrough();

export const ApifyKolPageSchema = z.object({
  data: z.array(ApifyKolItemSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});

export type ApifyKolItem = z.infer<typeof ApifyKolItemSchema>;
export type ApifyKolPage = z.infer<typeof ApifyKolPageSchema>;

export const APIFY_KOL_PLATFORMS = ["instagram", "tiktok", "youtube", "x"] as const;
export type ApifyKolPlatform = (typeof APIFY_KOL_PLATFORMS)[number];

export const APIFY_KOL_SORTS = [
  "relevance",
  "followers",
  "influence",
  "quality",
  "reachability",
  "recent",
] as const;
export type ApifyKolSort = (typeof APIFY_KOL_SORTS)[number];
