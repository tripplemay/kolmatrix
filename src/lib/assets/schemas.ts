/**
 * BL-025-F002 · Central Zod content schemas for the unified Asset table.
 *
 * The asset.content column is JSONB so Postgres can't enforce per-type
 * shape. createAsset / updateAsset (mutations.ts) parse against the
 * matching schema in ASSET_CONTENT_SCHEMAS so anything shaped wrong
 * fails at write-time rather than at the next reader. Adding a new
 * AssetType enum value (social_post, brief, ...) means: extend the
 * Prisma enum, define a new content schema here, register it in the
 * map, and the rest of the code (queries / generators / UI) reads
 * the type-narrowed result.
 *
 * Locale list intentionally tracks the next-intl supported set
 * (CN/EN/JA/KO/ES per CLAUDE.md project overview); broaden if/when a
 * new locale ships.
 */
import { AssetType } from "@prisma/client";
import { z } from "zod";

export const ASSET_CONTENT_LOCALES = ["en", "zh", "ja", "ko", "es"] as const;

// BL-035-F011 (CQ-H6): AssetVariableSchema, EmailContent and
// VideoScriptContent had no external consumers, so they're file-local
// now. Re-export when a real caller needs them.
const AssetVariableSchema = z.object({
  token: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  required: z.boolean().default(false),
});

export const EmailContentSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
  locale: z.enum(ASSET_CONTENT_LOCALES),
  variables: z.array(AssetVariableSchema).default([]),
});

export const VideoScriptContentSchema = z.object({
  title: z.string().min(1).max(200),
  script: z.string().min(1).max(20_000),
  durationHintSec: z.number().int().positive().max(3600).optional(),
});

// BL-067-F002 — explanation cache content schemas. The `name` field on
// the Asset row encodes the (campaignId, kolId, locale) cache key (per
// src/lib/explainability/cache.ts), so the content schema only needs
// to validate the rendered LLM payload.
export const AiRecommendationExplanationShortContentSchema = z.object({
  text: z.string().min(1).max(2_000),
});

export const AiRecommendationExplanationDetailedContentSchema = z.object({
  matchScore: z.string().min(1).max(2_000),
  categoryFit: z.string().min(1).max(2_000),
  recentActivity: z.string().min(1).max(2_000),
  audienceFit: z.string().min(1).max(2_000),
  brandHistory: z.string().min(1).max(2_000),
});

type EmailContent = z.infer<typeof EmailContentSchema>;
type VideoScriptContent = z.infer<typeof VideoScriptContentSchema>;
type AiRecommendationExplanationShortContent = z.infer<
  typeof AiRecommendationExplanationShortContentSchema
>;
type AiRecommendationExplanationDetailedContent = z.infer<
  typeof AiRecommendationExplanationDetailedContentSchema
>;

/**
 * Map AssetType → content Zod schema. Use with
 *   ASSET_CONTENT_SCHEMAS[type].parse(content)
 * to validate before write. Keep this exhaustive: TypeScript treats
 * AssetType as a string enum, so missing keys here become a runtime
 * gap in createAsset (caught by mutations.test.ts).
 */
export const ASSET_CONTENT_SCHEMAS = {
  email: EmailContentSchema,
  video_script: VideoScriptContentSchema,
  ai_recommendation_explanation_short:
    AiRecommendationExplanationShortContentSchema,
  ai_recommendation_explanation_detailed:
    AiRecommendationExplanationDetailedContentSchema,
} as const satisfies Record<AssetType, z.ZodTypeAny>;

export type AssetContentByType = {
  email: EmailContent;
  video_script: VideoScriptContent;
  ai_recommendation_explanation_short: AiRecommendationExplanationShortContent;
  ai_recommendation_explanation_detailed: AiRecommendationExplanationDetailedContent;
};
