"use server";

/**
 * BL-025-F003 · /assets server actions.
 *
 * generateAssetAction is the single entry point F004 / F007 call to
 * produce a new email or video_script asset (first generate or
 * regenerate). It:
 *   1. Authenticates the session + resolves tenantId.
 *   2. Verifies the product belongs to the caller's tenant (RLS via
 *      withTenant; if the row doesn't surface, the action treats it
 *      as not-found rather than guessing).
 *   3. Calls the typed generator (email- or video-script-).
 *   4. createAsset inside the same withTenant scope, capturing the
 *      generator usage in metadata + the parent chain on regenerate.
 *   5. Audit-logs `asset.generated` (parent absent) or
 *      `asset.regenerated` (parent present) so admin tooling can
 *      slice cost / model usage by tenant.
 *
 * The action returns a serializable result so the client can render
 * a friendly toast on either path; throwing would surface as a
 * Next.js redirect-style error which is wrong for this UX.
 */
import { z, ZodError } from "zod";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { createAsset } from "@/lib/assets/mutations";
import {
  generateEmailContent,
  EmailContentParseError,
} from "@/lib/assets/generators/email-generator";
import {
  generateVideoScriptContent,
  VideoScriptContentParseError,
} from "@/lib/assets/generators/video-script-generator";
import {
  AigcGatewayConfigError,
  AigcGatewayResponseError,
  AigcGatewayTimeoutError,
} from "@/lib/assets/generators/aigcgateway-client";
import { ASSET_CONTENT_LOCALES } from "@/lib/assets/schemas";
import type { AssetType } from "@/lib/assets/types";

const InputSchema = z.object({
  productId: z.string().min(1).max(100),
  type: z.enum(["email", "video_script"]),
  steeringPrompt: z.string().max(1000).optional(),
  parentAssetId: z.string().uuid().optional(),
  locale: z.enum(ASSET_CONTENT_LOCALES).optional(),
});

export type GenerateAssetInput = z.input<typeof InputSchema>;

export interface GenerateAssetSuccess {
  ok: true;
  assetId: string;
  parentAssetId: string | null;
}

export interface GenerateAssetFailure {
  ok: false;
  error: string;
  code:
    | "unauthorized"
    | "validation"
    | "product_not_found"
    | "parent_not_found"
    | "ai_config"
    | "ai_timeout"
    | "ai_response"
    | "ai_parse"
    | "internal";
}

export type GenerateAssetResult = GenerateAssetSuccess | GenerateAssetFailure;

function deriveAssetName(
  type: AssetType,
  productName: string,
  parentBaseName: string | null,
  variantOrdinal: number
): string {
  if (parentBaseName) {
    const base = parentBaseName.replace(/\s+v\d+$/i, "");
    return `${base} v${variantOrdinal}`;
  }
  if (type === "email") return `${productName} — Email v1`;
  return `${productName} — Script v1`;
}

export async function generateAssetAction(
  rawInput: unknown
): Promise<GenerateAssetResult> {
  let parsed: z.infer<typeof InputSchema>;
  try {
    parsed = InputSchema.parse(rawInput);
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        error: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        code: "validation",
      };
    }
    return { ok: false, error: "invalid input", code: "validation" };
  }

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!session?.user || !tenantId || !userId) {
    return { ok: false, error: "Not signed in", code: "unauthorized" };
  }

  // Phase 1 — read product + parent context inside withTenant so RLS
  // guarantees both belong to the caller. The product fetch happens
  // before the AI call so a missing product fails fast (no aigcgateway
  // spend wasted).
  const ctx = await withTenant(tenantId, async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: parsed.productId },
      select: {
        id: true,
        name: true,
        category: true,
        targetAudience: true,
        uniqueSellingPoints: true,
      },
    });
    if (!product) return { kind: "no_product" as const };

    let parent:
      | { id: string; name: string; type: AssetType; parentId: string | null }
      | null = null;
    let variantOrdinal = 1;
    if (parsed.parentAssetId) {
      const found = (await tx.asset.findUnique({
        where: { id: parsed.parentAssetId },
        select: { id: true, name: true, type: true, parentId: true },
      })) as {
        id: string;
        name: string;
        type: AssetType;
        parentId: string | null;
      } | null;
      if (!found) return { kind: "no_parent" as const };
      parent = found;
      // Find the root and count siblings (root + descendants).
      const rootId = found.parentId ?? found.id;
      const siblings = await tx.asset.count({
        where: {
          OR: [{ id: rootId }, { parentId: rootId }],
        },
      });
      variantOrdinal = siblings + 1;
    }

    return { kind: "ok" as const, product, parent, variantOrdinal };
  });

  if (ctx.kind === "no_product") {
    return { ok: false, error: "Product not found", code: "product_not_found" };
  }
  if (ctx.kind === "no_parent") {
    return { ok: false, error: "Parent asset not found", code: "parent_not_found" };
  }

  // Phase 2 — AI generation outside the DB tx (no holding a row lock
  // open across a 5-15s network call).
  let generated:
    | { contentJson: unknown; usage: { totalTokens: number }; traceId: string | null; model: string }
    | null = null;
  try {
    if (parsed.type === "email") {
      const r = await generateEmailContent({
        product: ctx.product,
        steeringPrompt: parsed.steeringPrompt,
        locale: parsed.locale,
      });
      generated = {
        contentJson: r.content,
        usage: r.usage,
        traceId: r.traceId,
        model: r.model,
      };
    } else {
      const r = await generateVideoScriptContent({
        product: ctx.product,
        steeringPrompt: parsed.steeringPrompt,
      });
      generated = {
        contentJson: r.content,
        usage: r.usage,
        traceId: r.traceId,
        model: r.model,
      };
    }
  } catch (err) {
    if (err instanceof AigcGatewayConfigError) {
      return {
        ok: false,
        error: "AI gateway not configured",
        code: "ai_config",
      };
    }
    if (err instanceof AigcGatewayTimeoutError) {
      return { ok: false, error: err.message, code: "ai_timeout" };
    }
    if (err instanceof AigcGatewayResponseError) {
      return { ok: false, error: err.message, code: "ai_response" };
    }
    if (
      err instanceof EmailContentParseError ||
      err instanceof VideoScriptContentParseError
    ) {
      return {
        ok: false,
        error: "AI returned an unparseable response",
        code: "ai_parse",
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
      code: "internal",
    };
  }

  if (!generated) {
    return { ok: false, error: "Empty AI result", code: "internal" };
  }

  // Phase 3 — persist + audit inside withTenant.
  const assetId = await withTenant(tenantId, async (tx) => {
    const detail = await createAsset(tx, tenantId, {
      type: parsed.type,
      name: deriveAssetName(
        parsed.type,
        ctx.product.name,
        ctx.parent?.name ?? null,
        ctx.variantOrdinal
      ),
      content: generated.contentJson,
      source: "ai_generated",
      status: "draft",
      productId: ctx.product.id,
      parentAssetId: parsed.parentAssetId ?? null,
      createdBy: userId,
      metadata: {
        traceId: generated.traceId ?? null,
        model: generated.model,
        tokensUsed: generated.usage.totalTokens,
        steeringPrompt: parsed.steeringPrompt ?? null,
        locale: parsed.locale ?? null,
        generatedAt: new Date().toISOString(),
      },
    });
    return detail.id;
  });

  await logAudit({
    actorId: userId,
    action: parsed.parentAssetId ? "asset.regenerated" : "asset.generated",
    targetType: "asset",
    targetId: assetId,
    tenantId,
    after: {
      assetId,
      productId: ctx.product.id,
      type: parsed.type,
      traceId: generated.traceId ?? null,
      model: generated.model,
      tokensUsed: generated.usage.totalTokens,
      steeringPrompt: parsed.steeringPrompt ?? null,
      parentAssetId: parsed.parentAssetId ?? null,
    },
    sanitizedFields: parsed.steeringPrompt ? [] : ["steeringPrompt"],
  });

  return {
    ok: true,
    assetId,
    parentAssetId: parsed.parentAssetId ?? null,
  };
}
