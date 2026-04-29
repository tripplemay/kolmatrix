"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";
import {
  generateAiAssets,
  markAiAssetsPending,
} from "@/lib/products/generateAiAssets";
import {
  createProductSchema,
  type CreateProductInput,
  type CreateProductState,
  PRODUCT_PLATFORMS,
  type ProductPlatform,
} from "@/lib/products/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractRaw(formData: FormData): Record<string, unknown> {
  const platforms = formData
    .getAll("platforms")
    .map(String)
    .filter((p): p is ProductPlatform =>
      (PRODUCT_PLATFORMS as readonly string[]).includes(p)
    );
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
  if (!tenantId || !UUID_RE.test(tenantId)) {
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
      // Fire-and-forget: the product is already saved, AI generation updates
      // aiAssets in the background. We detach via `void` so the Server Action
      // response returns immediately; the user refreshes to see the final
      // state (MVP — BM2 will stream updates via a job queue worker).
      void generateAiAssets({
        productId: product.id,
        tenantId,
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
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return { ok: false, error: "unauthorized" };
  }

  const productId = String(formData.get("productId") ?? "");
  if (!UUID_RE.test(productId)) {
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
    const product = await withTenant(tenantId, (tx) =>
      tx.product.update({
        where: { id: productId },
        data: {
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

export async function deleteProduct(productId: string): Promise<{ ok: boolean }> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId) || !UUID_RE.test(productId)) {
    return { ok: false };
  }

  try {
    await withTenant(tenantId, (tx) =>
      tx.product.delete({
        where: { id: productId },
      })
    );

    void logEvent({
      type: "product.deleted",
      tenantId,
      actorId: userId,
      resourceId: productId,
    });

    revalidatePath("/[locale]/knowledge-base", "page");
    return { ok: true };
  } catch (err) {
    console.error("[knowledge-base] deleteProduct failed:", err);
    return { ok: false };
  }
}
