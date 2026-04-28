"use server";

/**
 * BM2-F004 · Create-campaign Server Action.
 *
 * Form submits via useActionState → this Action runs the same
 * zod schema + createCampaignRecord helper that backs
 * POST /api/campaigns. On success we `redirect()` to the campaign
 * detail page (F005).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { auth } from "@/auth";
import {
  bulkAddKolsToCampaign,
  CampaignKolError,
} from "@/lib/campaigns/kol-operations";
import {
  createCampaignRecord,
  CampaignCreateError,
} from "@/lib/campaigns/create";
import {
  createCampaignSchemaWithDateOrder,
  type CreateCampaignFormErrors,
  type CreateCampaignState,
  CAMPAIGN_MARKETS,
  type CampaignMarket,
} from "@/lib/campaigns/schema";

const UUID_LIST_LIMIT = 50;
const UUID_LIST_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseSmartMatchKolIds(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_LIST_RE.test(s))
    .slice(0, UUID_LIST_LIMIT);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractRaw(
  formData: FormData,
  ownerUserId: string
): Record<string, unknown> {
  const markets = formData
    .getAll("markets")
    .map(String)
    .filter((m): m is CampaignMarket =>
      (CAMPAIGN_MARKETS as readonly string[]).includes(m)
    );
  return {
    name: String(formData.get("name") ?? ""),
    productId: String(formData.get("productId") ?? ""),
    budgetAmount: String(formData.get("budgetAmount") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    game: String(formData.get("game") ?? ""),
    markets,
    kpiTarget: String(formData.get("kpiTarget") ?? ""),
    ownerUserId,
  };
}

interface ZodIssueLike {
  path: readonly PropertyKey[];
  message: string;
}

function flattenErrors(
  issues: readonly ZodIssueLike[]
): CreateCampaignFormErrors {
  const errors: CreateCampaignFormErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      (errors as Record<string, string>)[key] = issue.message;
    }
  }
  return errors;
}

export async function createCampaign(
  _prev: CreateCampaignState,
  formData: FormData
): Promise<CreateCampaignState> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (
    !tenantId ||
    !UUID_RE.test(tenantId) ||
    !userId ||
    !UUID_RE.test(userId)
  ) {
    return {
      ok: false,
      errors: { form: "unauthorized" },
    };
  }

  const raw = extractRaw(formData, userId);
  const parsed = createCampaignSchemaWithDateOrder.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: flattenErrors(parsed.error.issues) };
  }

  let createdId: string;
  try {
    const result = await createCampaignRecord(tenantId, parsed.data);
    createdId = result.id;
  } catch (err) {
    if (err instanceof CampaignCreateError) {
      if (err.code === "product_not_found") {
        return { ok: false, errors: { productId: "productNotFound" } };
      }
    }
    return { ok: false, errors: { form: "generic" } };
  }

  // B7a-F002 — Smart Match "Save all to campaign" arrives with a
  // hidden input carrying the matched KOL ids; if present, attach
  // them to the freshly-created campaign before redirecting. Bulk
  // attach is best-effort (logs but doesn't block the redirect).
  const smartMatchKolIds = parseSmartMatchKolIds(
    String(formData.get("smartMatchKolIds") ?? "")
  );
  if (smartMatchKolIds.length > 0) {
    try {
      await bulkAddKolsToCampaign(
        tenantId,
        userId,
        createdId,
        smartMatchKolIds
      );
    } catch (err) {
      console.warn(
        `[smart-match attach] bulk-add failed for campaign ${createdId}: ${
          err instanceof CampaignKolError ? err.code : (err as Error).message
        }`
      );
    }
  }

  // Bust the list cache so the marketer sees the new campaign when
  // the redirect destination links back to /campaigns. Both locale
  // variants of the route need invalidation.
  revalidatePath("/[locale]/campaigns", "page");

  // BM1-F009 learning: redirect targets must be locale-prefixed so
  // the Next router keeps the URL and RSC payload in sync (a bare
  // `/campaigns/:id` would 307 to `/en/campaigns/:id` but keep the
  // browser URL at the non-locale path).
  const locale = await getLocale();
  // redirect() throws a NEXT_REDIRECT signal — must be outside
  // try/catch so Next's navigation short-circuit kicks in.
  redirect(`/${locale}/campaigns/${createdId}`);
}
