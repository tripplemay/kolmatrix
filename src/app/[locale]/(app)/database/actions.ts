"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";
import { rateLimitAi } from "@/lib/rate-limit-ai";
import { rateLimitBatchSend } from "@/lib/rate-limit-batch";
import {
  DatabaseIntelligenceError,
  type DatabaseIntelligenceInsight,
  generateDatabaseIntelligence,
} from "@/lib/kol-database/intelligence";

export type DatabaseInsightsActionResult =
  | { ok: true; insights: DatabaseIntelligenceInsight[]; traceId?: string }
  | { ok: false; error: string; retryAfter?: number };

// ----------------------------------------------------------------------
// BL-024-F001-3 — addKolAction (manual Add KOL form)
// ----------------------------------------------------------------------

const ADD_KOL_PLATFORMS = [
  "youtube",
  "tiktok",
  "instagram",
  "twitch",
  "bilibili",
  "x",
  "manual",
] as const;

const AddKolSchema = z.object({
  platform: z.enum(ADD_KOL_PLATFORMS),
  handle: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(200),
  url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : ""))
    .refine((v) => v === "" || /^https?:\/\/[^\s]+$/.test(v), {
      message: "invalid_url",
    }),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : ""))
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "invalid_email",
    }),
  followerCount: z.number().int().min(0).max(2_000_000_000).optional().default(0),
});

export type AddKolInput = z.input<typeof AddKolSchema>;

export type AddKolActionResult =
  | { ok: true; kolId: string }
  | { ok: false; error: string; retryAfter?: number };

export async function addKolAction(input: AddKolInput): Promise<AddKolActionResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return { ok: false, error: "unauthorized" };
  }

  // v0.9.11 §rate-limit dogfood — mutation row, 20/min/userId.
  const rl = await rateLimitBatchSend(userId);
  if (!rl.ok) {
    return { ok: false, error: "rate_limit_exceeded", retryAfter: rl.retryAfter };
  }

  const validation = AddKolSchema.safeParse(input);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    const code =
      issue?.message === "invalid_url" || issue?.message === "invalid_email"
        ? issue.message
        : "invalid_input";
    return { ok: false, error: code };
  }
  const data = validation.data;

  // Stable externalId for manual entries: "manual:" + handle (lowercased).
  // Mirrors the upsert key the CSV import uses so a later CSV re-import
  // updates instead of duplicating.
  const externalId = `manual:${data.handle.toLowerCase()}`;

  try {
    const created = await withTenant(tenantId, (tx) =>
      tx.kol.create({
        data: {
          tenantId,
          platform: data.platform,
          handle: data.handle,
          displayName: data.displayName,
          externalId,
          followerCount: data.followerCount,
          email: data.email || null,
          metadata: {
            source: "manual-add",
            added_at: new Date().toISOString(),
            added_by: userId,
            ...(data.url ? { profile_url: data.url } : {}),
          } as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
    );

    void logEvent({
      type: "database.kol_added",
      tenantId,
      actorId: userId,
      resourceId: created.id,
      payload: { platform: data.platform, handle: data.handle },
    });

    revalidatePath("/[locale]/database", "page");
    return { ok: true, kolId: created.id };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { ok: false, error: "duplicate" };
    }
    void logEvent({
      type: "database.kol_add_failed",
      tenantId,
      actorId: userId,
      payload: {
        message: (err as Error).message?.slice(0, 200) ?? "unknown",
      },
    });
    return { ok: false, error: "generic" };
  }
}

function tierForValueScore(valueScore: number | null): string {
  if (valueScore == null) return "unrated";
  if (valueScore >= 80) return "high";
  if (valueScore >= 60) return "medium";
  return "low";
}

export async function generateDatabaseInsightsAction(
  locale: string
): Promise<DatabaseInsightsActionResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId) return { ok: false, error: "unauthorized" };

  // BL-035-F003: per-tenant AI rate limit (10/min + 100/day).
  const rl = await rateLimitAi(tenantId);
  if (!rl.ok) {
    return { ok: false, error: "rate_limit_exceeded", retryAfter: rl.retryAfter };
  }

  void logEvent({
    type: "database.insights_clicked",
    tenantId,
    actorId: userId ?? undefined,
  });

  try {
    const rows = await withTenant(tenantId, (tx) =>
      tx.kol.findMany({
        where: {
          deletedAt: null,
          isSuspicious: false,
        },
        select: {
          countryCode: true,
          categories: true,
          relationshipStatus: true,
          valueScore: true,
        },
      })
    );

    const byRegion = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byTier = new Map<string, number>();
    const byRelationshipStatus = new Map<string, number>();

    for (const row of rows) {
      const region = row.countryCode ?? "unknown";
      byRegion.set(region, (byRegion.get(region) ?? 0) + 1);

      const tier = tierForValueScore(row.valueScore);
      byTier.set(tier, (byTier.get(tier) ?? 0) + 1);

      byRelationshipStatus.set(
        row.relationshipStatus,
        (byRelationshipStatus.get(row.relationshipStatus) ?? 0) + 1
      );

      if (row.categories.length === 0) {
        byCategory.set("Other", (byCategory.get("Other") ?? 0) + 1);
      } else {
        for (const cat of row.categories) {
          byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
        }
      }
    }

    const result = await generateDatabaseIntelligence({
      locale,
      snapshot: {
        total: rows.length,
        byRegion: [...byRegion.entries()].map(([region, count]) => ({ region, count })),
        byCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
        byTier: [...byTier.entries()].map(([tier, count]) => ({ tier, count })),
        byRelationshipStatus: [...byRelationshipStatus.entries()].map(([status, count]) => ({
          status,
          count,
        })),
      },
    });

    void logEvent({
      type: "database.insights_generated",
      tenantId,
      actorId: userId ?? undefined,
      payload: {
        traceId: result.traceId ?? null,
        count: result.insights.length,
      },
    });

    return { ok: true, insights: result.insights, traceId: result.traceId };
  } catch (err) {
    const code = err instanceof DatabaseIntelligenceError ? err.code : "generic";
    void logEvent({
      type: "database.insights_failed",
      tenantId,
      actorId: userId ?? undefined,
      payload: { code },
    });
    return { ok: false, error: code };
  }
}
