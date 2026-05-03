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
import {
  createAsset,
  updateAsset,
  archiveAsset,
  duplicateAsset,
  deleteAsset,
  AssetNotFoundError,
  AssetVariantDepthError,
} from "@/lib/assets/mutations";
import {
  loadAssetDetail,
  loadAssetsForListing,
  loadVariantTree,
  loadUsedIn,
} from "@/lib/assets/queries";
import type {
  AssetDetail,
  AssetListResult,
  AssetListSort,
  UsedInSummary,
  VariantTreeNode,
} from "@/lib/assets/types";
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
  asset: AssetDetail;
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

export async function generateAssetAction(rawInput: unknown): Promise<GenerateAssetResult> {
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

    let parent: { id: string; name: string; type: AssetType; parentId: string | null } | null =
      null;
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
  let generated: {
    contentJson: unknown;
    usage: { totalTokens: number };
    traceId: string | null;
    model: string;
  } | null = null;
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
    if (err instanceof EmailContentParseError || err instanceof VideoScriptContentParseError) {
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
  const detail = await withTenant(tenantId, async (tx) => {
    return createAsset(tx, tenantId, {
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
  });

  await logAudit({
    actorId: userId,
    action: parsed.parentAssetId ? "asset.regenerated" : "asset.generated",
    targetType: "asset",
    targetId: detail.id,
    tenantId,
    after: {
      assetId: detail.id,
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
    assetId: detail.id,
    parentAssetId: parsed.parentAssetId ?? null,
    asset: detail,
  };
}

// ---- BL-025-F005 · update + save-as-variant + variant tree / used-in loaders ----

const UpdateInputSchema = z.object({
  assetId: z.string().uuid(),
  patch: z
    .object({
      name: z.string().min(1).max(200).optional(),
      content: z.unknown().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
    })
    .refine((p) => p.name !== undefined || p.content !== undefined || p.status !== undefined, {
      message: "At least one of name / content / status must be set",
    }),
});

export type UpdateAssetInput = z.input<typeof UpdateInputSchema>;

export interface UpdateAssetSuccess {
  ok: true;
  asset: AssetDetail;
}

export interface UpdateAssetFailure {
  ok: false;
  error: string;
  code: "unauthorized" | "validation" | "asset_not_found" | "content_invalid" | "internal";
}

export type UpdateAssetResult = UpdateAssetSuccess | UpdateAssetFailure;

export async function updateAssetAction(rawInput: unknown): Promise<UpdateAssetResult> {
  let parsed: z.infer<typeof UpdateInputSchema>;
  try {
    parsed = UpdateInputSchema.parse(rawInput);
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

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const before = await loadAssetDetail(tx, parsed.assetId);
      if (!before) return { kind: "no_asset" as const };
      const after = await updateAsset(tx, parsed.assetId, parsed.patch);
      return { kind: "ok" as const, before, after };
    });
    if (result.kind === "no_asset") {
      return { ok: false, error: "Asset not found", code: "asset_not_found" };
    }

    await logAudit({
      actorId: userId,
      action: "asset.updated",
      targetType: "asset",
      targetId: result.after.id,
      tenantId,
      before: {
        name: result.before.name,
        status: result.before.status,
      },
      after: {
        name: result.after.name,
        status: result.after.status,
        contentChanged: parsed.patch.content !== undefined,
      },
    });

    return { ok: true, asset: result.after };
  } catch (err) {
    if (err instanceof AssetNotFoundError) {
      return { ok: false, error: err.message, code: "asset_not_found" };
    }
    if (err instanceof ZodError) {
      return {
        ok: false,
        error: "Content shape rejected by Zod",
        code: "content_invalid",
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
      code: "internal",
    };
  }
}

const SaveAsVariantInputSchema = z.object({
  parentAssetId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  // BL-026-F003.D Option A: content optional. When undefined, the
  // server falls back to the parent's existing content — closes the
  // BL-025 Restore-from-VersionsTab bug where a `content: {}` payload
  // wrote a blank asset (the variant tree only carries metadata, not
  // content, so the UI couldn't pass real content without an extra
  // round-trip).
  content: z.unknown().optional(),
});

export type SaveAssetAsVariantInput = z.input<typeof SaveAsVariantInputSchema>;

export interface SaveAsVariantSuccess {
  ok: true;
  asset: AssetDetail;
}

export interface SaveAsVariantFailure {
  ok: false;
  error: string;
  code:
    | "unauthorized"
    | "validation"
    | "parent_not_found"
    | "depth_exceeded"
    | "content_invalid"
    | "internal";
}

export type SaveAssetAsVariantResult = SaveAsVariantSuccess | SaveAsVariantFailure;

function bumpVersionSuffix(name: string, ordinal: number): string {
  return name.replace(/\s+v\d+$/i, "") + ` v${ordinal}`;
}

export async function saveAssetAsVariantAction(
  rawInput: unknown
): Promise<SaveAssetAsVariantResult> {
  let parsed: z.infer<typeof SaveAsVariantInputSchema>;
  try {
    parsed = SaveAsVariantInputSchema.parse(rawInput);
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

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const parent = await loadAssetDetail(tx, parsed.parentAssetId);
      if (!parent) return { kind: "no_parent" as const };
      const rootId = parent.parentId ?? parent.id;
      const siblings = await tx.asset.count({
        where: { OR: [{ id: rootId }, { parentId: rootId }] },
      });
      const ordinal = siblings + 1;
      const detail = await createAsset(tx, tenantId, {
        productId: parent.productId,
        type: parent.type,
        name: parsed.name ?? bumpVersionSuffix(parent.name, ordinal),
        // F003.D Option A: copy parent's content when caller omits it.
        // VariantSwitcher → Restore relies on this; EditTab callers
        // continue to pass real edited content.
        content: parsed.content !== undefined ? parsed.content : parent.content,
        source: "user_created",
        status: "draft",
        parentAssetId: parent.id,
        createdBy: userId,
        metadata: {
          savedFromAssetId: parent.id,
          savedAt: new Date().toISOString(),
        },
      });
      return { kind: "ok" as const, parent, detail };
    });

    if (result.kind === "no_parent") {
      return { ok: false, error: "Parent asset not found", code: "parent_not_found" };
    }

    await logAudit({
      actorId: userId,
      action: "asset.variant_saved",
      targetType: "asset",
      targetId: result.detail.id,
      tenantId,
      after: {
        assetId: result.detail.id,
        parentAssetId: result.parent.id,
        type: result.detail.type,
        productId: result.detail.productId,
      },
    });

    return { ok: true, asset: result.detail };
  } catch (err) {
    if (err instanceof AssetVariantDepthError) {
      return { ok: false, error: err.message, code: "depth_exceeded" };
    }
    if (err instanceof AssetNotFoundError) {
      return { ok: false, error: err.message, code: "parent_not_found" };
    }
    if (err instanceof ZodError) {
      return {
        ok: false,
        error: "Content shape rejected by Zod",
        code: "content_invalid",
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
      code: "internal",
    };
  }
}

// Read-only loaders surfaced through server actions so the detail
// panel can hot-load Versions / Used-in data when the active tab
// changes (avoids duplicating the queries in two places).

export async function loadVariantTreeAction(
  assetId: string
): Promise<{ ok: true; nodes: VariantTreeNode[] } | { ok: false; error: string }> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) return { ok: false, error: "Not signed in" };
  if (typeof assetId !== "string" || assetId.length === 0) {
    return { ok: false, error: "Invalid assetId" };
  }
  const nodes = await withTenant(tenantId, (tx) => loadVariantTree(tx, assetId));
  return { ok: true, nodes };
}

// ---- BL-025-F004 patch · loadMoreAssetsAction (infinite scroll) ----
//
// Client sentinel intersects → fetch the next page from the same
// filter+sort+cursor the server component used. Cursor is opaque
// (encodeCursor in queries.ts handles ordering) so we just pass it
// through. Filter is shaped by toAssetFilter on the client.

const LoadMoreInputSchema = z.object({
  filter: z.object({
    types: z.array(z.enum(["email", "video_script"])).optional(),
    statuses: z.array(z.enum(["draft", "published", "archived"])).optional(),
    sources: z
      .array(z.enum(["ai_generated", "user_created", "imported", "system_seed"]))
      .optional(),
    productId: z.string().optional(),
    search: z.string().optional(),
  }),
  cursor: z.string().min(1),
  sort: z.enum(["recent", "name", "type", "used_most"]).default("recent"),
  limit: z.number().int().min(1).max(60).default(24),
});

export type LoadMoreAssetsInput = z.input<typeof LoadMoreInputSchema>;

export type LoadMoreAssetsResult =
  | { ok: true; page: AssetListResult }
  | { ok: false; error: string; code: "unauthorized" | "validation" | "internal" };

export async function loadMoreAssetsAction(
  rawInput: unknown
): Promise<LoadMoreAssetsResult> {
  let parsed: z.infer<typeof LoadMoreInputSchema>;
  try {
    parsed = LoadMoreInputSchema.parse(rawInput);
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
  if (!tenantId) return { ok: false, error: "Not signed in", code: "unauthorized" };

  try {
    const page = await withTenant(tenantId, (tx) =>
      loadAssetsForListing(tx, parsed.filter, {
        cursor: parsed.cursor,
        sort: parsed.sort as AssetListSort,
        limit: parsed.limit,
      })
    );
    return { ok: true, page };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
      code: "internal",
    };
  }
}

export async function loadUsedInAction(
  assetId: string
): Promise<{ ok: true; summary: UsedInSummary } | { ok: false; error: string }> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) return { ok: false, error: "Not signed in" };
  if (typeof assetId !== "string" || assetId.length === 0) {
    return { ok: false, error: "Invalid assetId" };
  }
  const summary = await withTenant(tenantId, (tx) => loadUsedIn(tx, assetId));
  return { ok: true, summary };
}

// ---- BL-025-F005 patch · archive / duplicate / delete server actions ----
//
// AssetCard quick-action overlay + detail-panel "..." menu both call
// these. They share the same auth + RLS shape as updateAssetAction and
// audit each branch with a distinct action tag so admin tooling can
// surface "user X archived asset Y at T" without parsing free text.

const AssetIdInputSchema = z.object({
  assetId: z.string().uuid(),
});

export type AssetIdInput = z.input<typeof AssetIdInputSchema>;

interface MutationActionFailure {
  ok: false;
  error: string;
  code: "unauthorized" | "validation" | "asset_not_found" | "internal";
}

export interface ArchiveAssetSuccess {
  ok: true;
  asset: AssetDetail;
}

export type ArchiveAssetResult = ArchiveAssetSuccess | MutationActionFailure;

export async function archiveAssetAction(rawInput: unknown): Promise<ArchiveAssetResult> {
  let parsed: AssetIdInput;
  try {
    parsed = AssetIdInputSchema.parse(rawInput);
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

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const before = await loadAssetDetail(tx, parsed.assetId);
      if (!before) return { kind: "no_asset" as const };
      const after = await archiveAsset(tx, parsed.assetId);
      return { kind: "ok" as const, before, after };
    });
    if (result.kind === "no_asset") {
      return { ok: false, error: "Asset not found", code: "asset_not_found" };
    }

    await logAudit({
      actorId: userId,
      action: "asset.archived",
      targetType: "asset",
      targetId: result.after.id,
      tenantId,
      before: { status: result.before.status },
      after: { status: result.after.status },
    });

    return { ok: true, asset: result.after };
  } catch (err) {
    if (err instanceof AssetNotFoundError) {
      return { ok: false, error: err.message, code: "asset_not_found" };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
      code: "internal",
    };
  }
}

export interface DuplicateAssetSuccess {
  ok: true;
  asset: AssetDetail;
}

export type DuplicateAssetResult = DuplicateAssetSuccess | MutationActionFailure;

export async function duplicateAssetAction(rawInput: unknown): Promise<DuplicateAssetResult> {
  let parsed: AssetIdInput;
  try {
    parsed = AssetIdInputSchema.parse(rawInput);
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

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const source = await loadAssetDetail(tx, parsed.assetId);
      if (!source) return { kind: "no_asset" as const };
      const copy = await duplicateAsset(tx, tenantId, parsed.assetId, { createdBy: userId });
      return { kind: "ok" as const, source, copy };
    });
    if (result.kind === "no_asset") {
      return { ok: false, error: "Asset not found", code: "asset_not_found" };
    }

    await logAudit({
      actorId: userId,
      action: "asset.duplicated",
      targetType: "asset",
      targetId: result.copy.id,
      tenantId,
      after: {
        assetId: result.copy.id,
        sourceAssetId: result.source.id,
        type: result.copy.type,
        productId: result.copy.productId,
      },
    });

    return { ok: true, asset: result.copy };
  } catch (err) {
    if (err instanceof AssetNotFoundError) {
      return { ok: false, error: err.message, code: "asset_not_found" };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
      code: "internal",
    };
  }
}

export interface DeleteAssetSuccess {
  ok: true;
  assetId: string;
}

export type DeleteAssetResult = DeleteAssetSuccess | MutationActionFailure;

/**
 * Wizard "Discard" path: when the user generates a draft preview but
 * decides not to keep it, we hard-delete the row and audit-log it as
 * `asset.generated_discarded` instead of the regular `asset.deleted`.
 * Same auth + RLS shape as deleteAssetAction; the audit tag lets cost
 * tooling separate "user generated and abandoned" from "user deleted
 * a curated asset they had been using" (which is much rarer / more
 * meaningful for the lifecycle dashboard).
 */
export async function discardGeneratedAssetAction(
  rawInput: unknown
): Promise<DeleteAssetResult> {
  let parsed: AssetIdInput;
  try {
    parsed = AssetIdInputSchema.parse(rawInput);
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

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const before = await loadAssetDetail(tx, parsed.assetId);
      if (!before) return { kind: "no_asset" as const };
      const removed = await deleteAsset(tx, parsed.assetId);
      return { kind: "ok" as const, before, removed };
    });
    if (result.kind === "no_asset" || !result.removed) {
      return { ok: false, error: "Asset not found", code: "asset_not_found" };
    }

    const beforeMeta =
      result.before.metadata && typeof result.before.metadata === "object"
        ? (result.before.metadata as Record<string, unknown>)
        : {};
    await logAudit({
      actorId: userId,
      action: "asset.generated_discarded",
      targetType: "asset",
      targetId: result.before.id,
      tenantId,
      before: {
        name: result.before.name,
        type: result.before.type,
        traceId: typeof beforeMeta.traceId === "string" ? beforeMeta.traceId : null,
        model: typeof beforeMeta.model === "string" ? beforeMeta.model : null,
        tokensUsed: typeof beforeMeta.tokensUsed === "number" ? beforeMeta.tokensUsed : null,
      },
    });

    return { ok: true, assetId: result.before.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
      code: "internal",
    };
  }
}

export async function deleteAssetAction(rawInput: unknown): Promise<DeleteAssetResult> {
  let parsed: AssetIdInput;
  try {
    parsed = AssetIdInputSchema.parse(rawInput);
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

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const before = await loadAssetDetail(tx, parsed.assetId);
      if (!before) return { kind: "no_asset" as const };
      const removed = await deleteAsset(tx, parsed.assetId);
      return { kind: "ok" as const, before, removed };
    });
    if (result.kind === "no_asset" || !result.removed) {
      return { ok: false, error: "Asset not found", code: "asset_not_found" };
    }

    await logAudit({
      actorId: userId,
      action: "asset.deleted",
      targetType: "asset",
      targetId: result.before.id,
      tenantId,
      before: {
        name: result.before.name,
        type: result.before.type,
        status: result.before.status,
      },
    });

    return { ok: true, assetId: result.before.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
      code: "internal",
    };
  }
}
