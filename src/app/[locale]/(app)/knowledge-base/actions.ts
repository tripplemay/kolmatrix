"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  loadProductAssets,
  type ProductAssetListItem,
} from "@/lib/assets/queries";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";
import { generateAiAssets, markAiAssetsPending } from "@/lib/products/generateAiAssets";
import {
  createProductSchema,
  type CreateProductInput,
  type CreateProductState,
  PRODUCT_PLATFORMS,
  type ProductPlatform,
} from "@/lib/products/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Product.id is `@default(cuid())` (Planner 裁决 BL-020 #1:A — see
// docs/specs/BL-020-F001-audit-cuid-vs-uuid.md). CUID v1 is `c` + 24
// lowercase alphanum chars; CUID v2 stays prefixed but variable-length,
// so we accept 24+ trailing chars. Equivalent SQL-injection / path-
// traversal protection to the original spec UUID_RE.
const PRODUCT_ID_RE = /^c[a-z0-9]{24,}$/i;

function normalizeProductId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const productId = value.trim();
  if (productId.length === 0) return null;
  if (!PRODUCT_ID_RE.test(productId)) return null;
  return productId;
}

function extractRaw(formData: FormData): Record<string, unknown> {
  const platforms = formData
    .getAll("platforms")
    .map(String)
    .filter((p): p is ProductPlatform => (PRODUCT_PLATFORMS as readonly string[]).includes(p));
  return {
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    targetAudience: String(formData.get("targetAudience") ?? ""),
    uniqueSellingPoints: String(formData.get("uniqueSellingPoints") ?? ""),
    downloadUrl: String(formData.get("downloadUrl") ?? ""),
    launchDate: String(formData.get("launchDate") ?? ""),
    platforms,
    generateImmediately: formData.get("generateImmediately") === "on",
  };
}

export async function createProduct(
  _prev: CreateProductState,
  formData: FormData
): Promise<CreateProductState> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  // BL-030-F001 — userId is now load-bearing (passed to
  // generateAiAssets.actorUserId for createAsset.createdBy + audit
  // attribution). Harden the check so a session missing user.id
  // can't slip through into a downstream "actorId: undefined" write.
  if (!tenantId || !UUID_RE.test(tenantId) || !userId) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = createProductSchema.safeParse(extractRaw(formData));
  if (!parsed.success) {
    const fieldErrors: CreateProductState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key !== "string") continue;
      const field = key as keyof CreateProductInput;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "invalid_input", fieldErrors };
  }
  const data = parsed.data;

  try {
    const product = await withTenant(tenantId, (tx) =>
      tx.product.create({
        data: {
          tenantId,
          name: data.name,
          category: data.category,
          targetAudience: data.targetAudience ?? null,
          uniqueSellingPoints: data.uniqueSellingPoints,
          downloadUrl: data.downloadUrl ?? null,
          launchDate: data.launchDate ? new Date(data.launchDate) : null,
        },
      })
    );

    void logEvent({
      type: "product.created",
      tenantId,
      actorId: userId,
      resourceId: product.id,
      payload: {
        category: data.category,
        platforms: data.platforms,
        generateImmediately: data.generateImmediately,
      },
    });

    if (data.generateImmediately) {
      await markAiAssetsPending(tenantId, product.id);
      // Fire-and-forget: the product is already saved, AI generation
      // writes to the Asset table + shrinks Product.aiAssets to a
      // status tracker in the background (BL-030-F001). We detach via
      // `void` so the Server Action response returns immediately; the
      // user refreshes to see the final state.
      void generateAiAssets({
        productId: product.id,
        tenantId,
        actorUserId: userId,
        name: product.name,
        category: product.category,
        targetAudience: product.targetAudience,
        uniqueSellingPoints: product.uniqueSellingPoints,
        downloadUrl: product.downloadUrl,
      });
    }

    revalidatePath("/[locale]/knowledge-base", "page");

    return { ok: true, productId: product.id };
  } catch (err) {
    console.error("[knowledge-base] createProduct failed:", err);
    return { ok: false, error: "generic" };
  }
}

export async function updateProduct(
  _prev: CreateProductState,
  formData: FormData
): Promise<CreateProductState> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId) || !userId) {
    return { ok: false, error: "unauthorized" };
  }

  const productId = normalizeProductId(formData.get("productId"));
  if (!productId) {
    return { ok: false, error: "invalid_input" };
  }

  const parsed = createProductSchema.safeParse(extractRaw(formData));
  if (!parsed.success) {
    const fieldErrors: CreateProductState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key !== "string") continue;
      const field = key as keyof CreateProductInput;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "invalid_input", fieldErrors };
  }
  const data = parsed.data;

  try {
    const product = await withTenant(tenantId, async (tx) => {
      // BL-035-F005 (API-H3): explicit ownership preflight on top of
      // RLS. Returning the same `not_found` error for both "row missing"
      // and "row owned by another tenant" stops the action from leaking
      // whether a cross-tenant product id exists. RLS narrows
      // findUnique to the caller's tenant, so a cross-tenant id
      // surfaces as null here too — but the explicit tenantId check is
      // a defence-in-depth tripwire for an RLS misconfiguration.
      const existing = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, tenantId: true },
      });
      if (!existing || existing.tenantId !== tenantId) {
        return null;
      }
      return tx.product.update({
        where: { id: productId },
        data: {
          name: data.name,
          category: data.category,
          targetAudience: data.targetAudience ?? null,
          uniqueSellingPoints: data.uniqueSellingPoints,
          downloadUrl: data.downloadUrl ?? null,
          launchDate: data.launchDate ? new Date(data.launchDate) : null,
        },
      });
    });

    if (!product) {
      return { ok: false, error: "not_found" };
    }

    void logEvent({
      type: "product.updated",
      tenantId,
      actorId: userId,
      resourceId: product.id,
      payload: {
        category: data.category,
        platforms: data.platforms,
        regenerateImmediately: data.generateImmediately,
      },
    });

    if (data.generateImmediately) {
      await markAiAssetsPending(tenantId, product.id);
      void generateAiAssets({
        productId: product.id,
        tenantId,
        actorUserId: userId,
        name: product.name,
        category: product.category,
        targetAudience: product.targetAudience,
        uniqueSellingPoints: product.uniqueSellingPoints,
        downloadUrl: product.downloadUrl,
      });
    }

    revalidatePath("/[locale]/knowledge-base", "page");
    return { ok: true, productId: product.id };
  } catch (err) {
    console.error("[knowledge-base] updateProduct failed:", err);
    return { ok: false, error: "generic" };
  }
}

/**
 * MVP-internal-demo-prep verifying-2026-05-01 fix C-05.2.
 * F003 acceptance promised a "Generate AI assets" trigger on cards with
 * null aiAssets, but only the create/edit-modal `generateImmediately`
 * checkbox actually wired generation. This action lets ProductCard
 * launch a fire-and-forget generation without reopening the modal.
 */
export async function triggerAiGeneration(
  productId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  const normalizedProductId = normalizeProductId(productId);
  if (!tenantId || !UUID_RE.test(tenantId) || !normalizedProductId || !userId) {
    return { ok: false, error: "unauthorized" };
  }

  try {
    const product = await withTenant(tenantId, (tx) =>
      tx.product.findUnique({
        where: { id: normalizedProductId },
        select: {
          id: true,
          name: true,
          category: true,
          targetAudience: true,
          uniqueSellingPoints: true,
          downloadUrl: true,
        },
      })
    );
    if (!product) {
      return { ok: false, error: "not_found" };
    }

    await markAiAssetsPending(tenantId, product.id);
    // Fire-and-forget — same shape as createProduct/updateProduct so the
    // UI gets a fast turnaround and revalidates on the next page render.
    void generateAiAssets({
      productId: product.id,
      tenantId,
      actorUserId: userId,
      name: product.name,
      category: product.category,
      targetAudience: product.targetAudience,
      uniqueSellingPoints: product.uniqueSellingPoints,
      downloadUrl: product.downloadUrl,
    });

    void logEvent({
      type: "product.ai_generate_requested",
      tenantId,
      actorId: userId,
      resourceId: product.id,
    });

    revalidatePath("/[locale]/knowledge-base", "page");
    return { ok: true };
  } catch (err) {
    console.error("[knowledge-base] triggerAiGeneration failed:", err);
    return { ok: false, error: "generic" };
  }
}

export type DeleteProductResult = { ok: true } | { ok: false; error?: "not_found" };

export async function deleteProduct(productId: string): Promise<DeleteProductResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  const normalizedProductId = normalizeProductId(productId);
  if (!tenantId || !UUID_RE.test(tenantId) || !normalizedProductId) {
    return { ok: false };
  }

  try {
    // BL-035-F005 (API-H3): same ownership preflight as updateProduct.
    // Returning `not_found` (not "forbidden") avoids leaking whether
    // the product id corresponds to a row owned by another tenant.
    const result = await withTenant(tenantId, async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id: normalizedProductId },
        select: { id: true, tenantId: true },
      });
      if (!existing || existing.tenantId !== tenantId) {
        return { kind: "not_found" as const };
      }
      await tx.product.delete({ where: { id: normalizedProductId } });
      return { kind: "deleted" as const };
    });

    if (result.kind === "not_found") {
      return { ok: false, error: "not_found" };
    }

    void logEvent({
      type: "product.deleted",
      tenantId,
      actorId: userId,
      resourceId: normalizedProductId,
    });

    revalidatePath("/[locale]/knowledge-base", "page");
    return { ok: true };
  } catch (err) {
    console.error("[knowledge-base] deleteProduct failed:", err);
    return { ok: false };
  }
}

// BL-030-F002 — ProductModal lazy-loads the per-product Asset list
// when the modal opens so the "AI Assets Generated" panel can render
// real Asset rows (name + status + jump link) instead of the legacy
// `aiAssets.emailTemplates.length` count text. The action is read-only
// and runs inside withTenant for RLS scope.
export type LoadProductAssetsResult =
  | { ok: true; assets: ProductAssetListItem[] }
  | { ok: false; error: "unauthorized" | "invalid_input" | "generic" };

export async function loadProductAssetsAction(
  productId: string
): Promise<LoadProductAssetsResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const normalizedProductId = normalizeProductId(productId);
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return { ok: false, error: "unauthorized" };
  }
  if (!normalizedProductId) {
    return { ok: false, error: "invalid_input" };
  }
  try {
    const assets = await withTenant(tenantId, (tx) =>
      loadProductAssets(tx, normalizedProductId)
    );
    return { ok: true, assets };
  } catch (err) {
    console.error("[knowledge-base] loadProductAssetsAction failed:", err);
    return { ok: false, error: "generic" };
  }
}
