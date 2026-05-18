"use server";

/**
 * BL-069-F002 · Server action for the natural-language brief parser.
 *
 * `parseBriefAction` takes a free-form marketing brief plus the user's
 * locale and returns either a structured `ParsedBriefFields` payload
 * (productId / markets / budget / target_audience / categories / dates)
 * + 5-locale feedback, or `unparsable=true` when the brief is too vague
 * to map onto activity fields. Per spec §5 不变量 #4 the action never
 * surfaces the input rawBrief or per-product metadata back to the
 * caller — only the structured parse output — so the UI form-fill is
 * deterministic.
 *
 * Flow (per docs/specs/BL-069-F001-prompt-design.md §4 + BL-068 F002
 * `applyRefineAction` shape):
 *   1. Session auth + tenant scope
 *   2. Input validation (rawBrief length, locale enum)
 *   3. rateLimitBatchSend (20/min/user, shared with BL-067/BL-068)
 *   4. checkLlmCostBudget → cap exhausted: audit `ai_brief.parse_cap_exhausted`,
 *      return capExhausted=true (silent fallback per §5 不变量 #4)
 *   5. Fetch tenant products via withTenant RLS (id/name/category only —
 *      keep token budget low; description/keywords/embedding stay private)
 *   6. wrapUserInput on raw_brief + available_products_json
 *   7. runAigcAction (AIGCGATEWAY_BRIEF_PARSE_ACTION_ID → kol-brief-parse v2)
 *      → catch race-condition AiDailyCostExceededError → same fallback as
 *      step 4
 *   8. Parse output, branch:
 *        - LLM unparsable: audit `ai_brief.parse_unparsable`, return
 *          unparsable=true with reason_locale[locale] as feedback
 *        - productId cross-tenant: LLM returned a productId not in the
 *          tenant's product set (hallucination guard per §5 不变量 #5)
 *          → audit `ai_brief.parse_unparsable` with reason=
 *          productId_cross_tenant, return unparsable=true + errorKind
 *        - malformed: missing required structural fields → audit
 *          `ai_brief.parse_unparsable` with reason=malformed_structure,
 *          return unparsable=true + errorKind=malformed
 *        - success: normalize (dedupe markets/categories per v0.9.22 #10)
 *          + clamp target_audience + validate budget/dates → audit
 *          `ai_brief.parse_applied` (raw_brief + parsed_fields + token /
 *          cost — Phase 5 personalization training data per §5 不变量 #7)
 *          + return parsed fields
 *
 * Notes vs BL-068 F002:
 *   - Product.id is **cuid** (not uuid), so no UUID regex on productId;
 *     set-membership via `Set<string>` is sufficient.
 *   - Product.category is a **single String** column (not array). The
 *     LLM prompt v2 expects `categories: string[]`, so the mapper wraps
 *     `[product.category]` when building available_products_json.
 *   - No permutation validation (no ordered_kol_ids — the output is
 *     structured fields, not a list of input IDs).
 */

import { auth } from "@/auth";
import { runAigcAction, AiDailyCostExceededError } from "@/lib/aigc/run-action";
import { wrapUserInput } from "@/lib/ai/xml-escape";
import { checkLlmCostBudget } from "@/lib/ai/cost-cap";
import { logAudit } from "@/lib/audit/log";
import {
  createCampaignRecord,
  CampaignCreateError,
} from "@/lib/campaigns/create";
import {
  CAMPAIGN_MARKETS,
  type CampaignMarket,
} from "@/lib/campaigns/schema";
import { withTenant } from "@/lib/db";
import { rateLimitBatchSend } from "@/lib/rate-limit-batch";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES_ALL = ["en", "zh", "ja", "ko", "es"] as const;
const LOCALES = new Set<string>(LOCALES_ALL);
type Locale = (typeof LOCALES_ALL)[number];

const RAW_BRIEF_MIN_LEN = 1;
const RAW_BRIEF_MAX_LEN = 2000;
const TARGET_AUDIENCE_MAX_LEN = 500;

export type ParseBriefActionError =
  | "unauthorized"
  | "validation_failed"
  | "rate_limit_exceeded"
  | "internal_error";

export interface ParsedBriefFields {
  productId: string | null;
  markets: string[];
  budget: { amount: number; currency: string } | null;
  targetAudience: string;
  categories: string[];
  startDate: string | null;
  endDate: string | null;
}

export interface ParseBriefSuccessData {
  /** Structured fields when LLM parsed successfully; null on any fallback. */
  parsed: ParsedBriefFields | null;
  /** LLM feedback for the caller's locale, or "" when no feedback applies. */
  feedback: string;
  /** True when LLM declined to parse, productId cross-tenant, or malformed. */
  unparsable: boolean;
  /** True when cost-cap blocked the call (pre-check or in-flight race). */
  capExhausted: boolean;
  /**
   * Discriminator on the 3 fallback sub-paths (mirrors BL-068 F002
   * ApplyRefineSuccessData.errorKind):
   *   - 'unparsable' — LLM returned {unparsable:true, reason_locale}
   *   - 'malformed' — LLM output missing required structural fields
   *   - 'product_cross_tenant' — LLM productId not in tenant's product list
   * Only set when `unparsable === true`; absent on success and capExhausted.
   */
  errorKind?: "unparsable" | "malformed" | "product_cross_tenant";
}

export type ParseBriefActionResult =
  | { ok: true; data: ParseBriefSuccessData }
  | { ok: false; error: ParseBriefActionError; retryAfter?: number };

export interface ParseBriefInput {
  rawBrief: string;
  locale: string;
}

interface ProductRow {
  id: string;
  name: string;
  category: string;
}

interface BriefLlmOutput {
  unparsable?: boolean;
  productId?: unknown;
  markets?: unknown;
  budget?: unknown;
  target_audience?: unknown;
  categories?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  feedback_summary?: unknown;
  reason_locale?: unknown;
}

/**
 * Parse a natural-language marketing brief into structured campaign
 * fields. Never throws — all error modes map to either an error result
 * or a silent-fallback success with `parsed=null`.
 */
export async function parseBriefAction(
  input: ParseBriefInput,
): Promise<ParseBriefActionResult> {
  // 1. Session + tenant scope
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId) || !userId || !UUID_RE.test(userId)) {
    return { ok: false, error: "unauthorized" };
  }

  // 2. Input validation
  if (!LOCALES.has(input.locale)) {
    return { ok: false, error: "validation_failed" };
  }
  const locale = input.locale as Locale;
  if (
    typeof input.rawBrief !== "string" ||
    input.rawBrief.trim().length < RAW_BRIEF_MIN_LEN ||
    input.rawBrief.length > RAW_BRIEF_MAX_LEN
  ) {
    return { ok: false, error: "validation_failed" };
  }

  // 3. Rate limit (BL-067 F004 / BL-068 F002 same pattern)
  const rl = await rateLimitBatchSend(userId);
  if (!rl.ok) {
    return {
      ok: false,
      error: "rate_limit_exceeded",
      retryAfter: rl.retryAfter,
    };
  }

  // 4. Cost-cap pre-check (silent fallback per §5 不变量 #4)
  const budget = await checkLlmCostBudget(tenantId);
  if (!budget.allowed) {
    void logAudit({
      actorId: userId,
      action: "ai_brief.parse_cap_exhausted",
      targetType: "brief",
      targetId: "draft",
      tenantId,
      after: { raw_brief: input.rawBrief, locale },
    });
    return {
      ok: true,
      data: {
        parsed: null,
        feedback: "",
        unparsable: false,
        capExhausted: true,
      },
    };
  }

  // 5. Fetch tenant products via RLS (id/name/category only — minimize
  // token budget and avoid leaking description / keywords to the LLM).
  // Soft-deleted rows are excluded.
  let products: ProductRow[];
  try {
    products = await withTenant(tenantId, async (tx) => {
      const rows = await tx.product.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, category: true },
      });
      return rows as ProductRow[];
    });
  } catch (err) {
    console.error("[parseBriefAction] product fetch error:", err);
    return { ok: false, error: "internal_error" };
  }

  // 6. AIGCGATEWAY action id must be configured at deploy time.
  const actionId = process.env.AIGCGATEWAY_BRIEF_PARSE_ACTION_ID;
  if (!actionId) {
    console.error(
      "[parseBriefAction] AIGCGATEWAY_BRIEF_PARSE_ACTION_ID not configured",
    );
    return { ok: false, error: "internal_error" };
  }

  // Wrap product schema for the LLM: prompt v2 expects
  // `categories: string[]` on each product, but Product.category is a
  // single column. Wrap as `[product.category]` so the prompt template
  // doesn't need to change shape.
  const productsForLlm = products.map((p) => ({
    id: p.id,
    name: p.name,
    categories: [p.category],
  }));

  const variables: Record<string, string> = {
    raw_brief: wrapUserInput("USER_RAW_BRIEF", input.rawBrief),
    available_products_json: wrapUserInput(
      "USER_AVAILABLE_PRODUCTS_JSON",
      JSON.stringify(productsForLlm),
    ),
    user_locale: locale,
  };

  // 7. Call SDK (cap race-condition handled by AiDailyCostExceededError catch)
  let llmResult: Awaited<ReturnType<typeof runAigcAction<BriefLlmOutput>>>;
  try {
    llmResult = await runAigcAction<BriefLlmOutput>({
      actionId,
      variables,
      tenantId,
      actionLabel: "ai_brief_parse",
      timeoutMs: 30_000,
    });
  } catch (err) {
    if (err instanceof AiDailyCostExceededError) {
      void logAudit({
        actorId: userId,
        action: "ai_brief.parse_cap_exhausted",
        targetType: "brief",
        targetId: "draft",
        tenantId,
        after: { raw_brief: input.rawBrief, locale, race_condition: true },
      });
      return {
        ok: true,
        data: {
          parsed: null,
          feedback: "",
          unparsable: false,
          capExhausted: true,
        },
      };
    }
    console.error("[parseBriefAction] LLM call failed:", err);
    return { ok: false, error: "internal_error" };
  }

  const parsed = llmResult.output;
  const traceId = llmResult.traceId;

  // 8. Branch 1: LLM declined to parse.
  if (parsed?.unparsable === true) {
    const reason = readLocaleString(parsed.reason_locale, locale);
    void logAudit({
      actorId: userId,
      action: "ai_brief.parse_unparsable",
      targetType: "brief",
      targetId: "draft",
      tenantId,
      after: { raw_brief: input.rawBrief, locale, traceId },
    });
    return {
      ok: true,
      data: {
        parsed: null,
        feedback: reason,
        unparsable: true,
        capExhausted: false,
        errorKind: "unparsable",
      },
    };
  }

  // 9. Branch 2: productId cross-tenant validation (§5 不变量 #5).
  // dedupe-then-validate spirit (v0.9.22 #10): LLM may hallucinate a
  // UUID-shaped string that doesn't match any tenant product. Reject
  // those calls as unparsable rather than silently dropping the field —
  // the user-visible toast tells them the product wasn't found, and the
  // audit record carries the rejected id for monitoring LLM noise rate.
  const productIds = new Set(products.map((p) => p.id));
  const returnedProductIdRaw = parsed?.productId;
  const returnedProductId =
    typeof returnedProductIdRaw === "string" && returnedProductIdRaw.length > 0
      ? returnedProductIdRaw
      : null;
  if (returnedProductId !== null && !productIds.has(returnedProductId)) {
    void logAudit({
      actorId: userId,
      action: "ai_brief.parse_unparsable",
      targetType: "brief",
      targetId: "draft",
      tenantId,
      after: {
        raw_brief: input.rawBrief,
        locale,
        reason: "productId_cross_tenant",
        rejected_productId: returnedProductId,
        traceId,
      },
    });
    return {
      ok: true,
      data: {
        parsed: null,
        feedback: "",
        unparsable: true,
        capExhausted: false,
        errorKind: "product_cross_tenant",
      },
    };
  }

  // 10. Branch 3: malformed output (missing required structural fields).
  if (
    !Array.isArray(parsed?.markets) ||
    !Array.isArray(parsed?.categories) ||
    typeof parsed?.target_audience !== "string"
  ) {
    void logAudit({
      actorId: userId,
      action: "ai_brief.parse_unparsable",
      targetType: "brief",
      targetId: "draft",
      tenantId,
      after: {
        raw_brief: input.rawBrief,
        locale,
        reason: "malformed_structure",
        traceId,
      },
    });
    return {
      ok: true,
      data: {
        parsed: null,
        feedback: "",
        unparsable: true,
        capExhausted: false,
        errorKind: "malformed",
      },
    };
  }

  // 11. Branch 4: success — normalize fields (dedupe per v0.9.22 #10,
  // validate budget/dates, clamp target_audience).
  const dedupedMarkets = Array.from(
    new Set(
      (parsed.markets as unknown[]).filter(
        (m): m is string => typeof m === "string" && m.length > 0,
      ),
    ),
  );
  const dedupedCategories = Array.from(
    new Set(
      (parsed.categories as unknown[]).filter(
        (c): c is string => typeof c === "string" && c.length > 0,
      ),
    ),
  );

  const parsedFields: ParsedBriefFields = {
    productId: returnedProductId,
    markets: dedupedMarkets,
    budget: validateBudget(parsed.budget),
    targetAudience: parsed.target_audience.slice(0, TARGET_AUDIENCE_MAX_LEN),
    categories: dedupedCategories,
    startDate: validateIsoDate(parsed.start_date),
    endDate: validateIsoDate(parsed.end_date),
  };

  const feedback = readLocaleString(parsed.feedback_summary, locale);
  void logAudit({
    actorId: userId,
    action: "ai_brief.parse_applied",
    targetType: "brief",
    targetId: "draft",
    tenantId,
    after: {
      raw_brief: input.rawBrief,
      parsed_fields: parsedFields,
      locale,
      token_usage: llmResult.usage.totalTokens,
      cost_usd: llmResult.usage.costUsd,
      traceId,
    },
  });
  return {
    ok: true,
    data: {
      parsed: parsedFields,
      feedback,
      unparsable: false,
      capExhausted: false,
    },
  };
}

/**
 * Safely extract `obj[locale]` as a string. LLM output structure is
 * untrusted JSON — any shape mismatch collapses to "" so the UI gets a
 * clean fallback instead of `[object Object]` style leakage.
 */
function readLocaleString(obj: unknown, locale: Locale): string {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "";
  const value = (obj as Record<string, unknown>)[locale];
  return typeof value === "string" ? value : "";
}

/**
 * Validate the LLM-returned budget object. Returns null on any shape
 * mismatch so the UI form-fill leaves the field empty rather than
 * showing an invalid value.
 */
function validateBudget(
  b: unknown,
): { amount: number; currency: string } | null {
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const obj = b as Record<string, unknown>;
  if (typeof obj.amount !== "number" || obj.amount <= 0) return null;
  if (typeof obj.currency !== "string" || obj.currency.length !== 3) {
    return null;
  }
  return { amount: obj.amount, currency: obj.currency.toUpperCase() };
}

/**
 * Validate ISO-8601 date string (YYYY-MM-DD). Returns null on any
 * mismatch so the UI form-fill leaves the date picker empty.
 */
function validateIsoDate(d: unknown): string | null {
  if (typeof d !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// BL-069-F005 · createCampaignFromBriefAction
// ---------------------------------------------------------------------------

/**
 * Input shape from the BriefPageClient submit handler — mirrors the
 * `ParsedBriefFields` returned by `parseBriefAction` PLUS an optional
 * user-edited `name`. The form lets the user override every parsed
 * field before submit, so the action treats the input as authoritative
 * and does NOT re-call the LLM.
 */
export interface CreateCampaignFromBriefInput {
  /** Optional user-typed name. Empty/whitespace → auto-generate from
   *  product name + first market (user ack option A 2026-05-18). */
  name?: string;
  productId: string;
  markets: string[];
  budget: { amount: number; currency: string } | null;
  startDate: string | null;
  endDate: string | null;
  targetAudience: string;
  categories: string[];
}

export type CreateCampaignFromBriefError =
  | "unauthorized"
  | "validation_failed"
  | "product_not_found"
  | "internal_error";

export type CreateCampaignFromBriefResult =
  | { ok: true; campaignId: string }
  | { ok: false; error: CreateCampaignFromBriefError };

const NAME_MAX_LEN = 80;
const CURRENCY_RE = /^[A-Z]{3}$/;

/**
 * Persist a campaign created via the AI brief flow. Reuses
 * `createCampaignRecord` (BM2-F004 sediment) so tenant scoping +
 * product validation + event_log are identical to /campaigns/new,
 * while routing brief-specific fields (target_audience, categories,
 * non-USD budgetCurrency) through the F005 `extras` channel that
 * stashes them in the `kpi_target` JSON column (0 schema migration).
 *
 * Per spec §F005:
 *   - On success, returns `{ ok: true, campaignId }`; caller
 *     (BriefPageClient) router.push("/match?campaignId=:id") so the
 *     /match mount triggers the BL-067 F005 pre-warm worker.
 *   - On failure, returns `{ ok: false, error }` and the client
 *     surfaces a toast; the form stays usable.
 */
export async function createCampaignFromBriefAction(
  input: CreateCampaignFromBriefInput,
): Promise<CreateCampaignFromBriefResult> {
  // 1. Session auth
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId) || !userId || !UUID_RE.test(userId)) {
    return { ok: false, error: "unauthorized" };
  }

  // 2. Input validation — productId is required + non-empty; markets
  // get normalised to the CAMPAIGN_MARKETS enum (LLM returns uppercase
  // "SEA"/"JP" while the enum is lowercase).
  if (typeof input.productId !== "string" || input.productId.length === 0) {
    return { ok: false, error: "validation_failed" };
  }
  if (input.productId.length > 64) {
    return { ok: false, error: "validation_failed" };
  }
  const normalizedMarkets = (input.markets ?? [])
    .filter((m): m is string => typeof m === "string")
    .map((m) => m.toLowerCase())
    .filter((m): m is CampaignMarket =>
      (CAMPAIGN_MARKETS as readonly string[]).includes(m),
    );

  // 3. Look up the product name now so we can auto-generate a campaign
  // name when the user left the field blank. Cross-tenant access is
  // blocked by RLS; missing or soft-deleted product → product_not_found.
  let productName: string;
  try {
    const product = await withTenant(tenantId, (tx) =>
      tx.product.findFirst({
        where: { id: input.productId, deletedAt: null },
        select: { name: true },
      }),
    );
    if (!product) {
      return { ok: false, error: "product_not_found" };
    }
    productName = product.name;
  } catch (err) {
    console.error("[createCampaignFromBriefAction] product lookup failed:", err);
    return { ok: false, error: "internal_error" };
  }

  // 4. Resolve campaign name (user input > auto-generated).
  const trimmedName = input.name?.trim() ?? "";
  const autoName = `${productName} — ${(normalizedMarkets[0] ?? "global").toUpperCase()}`;
  const finalName = (trimmedName.length > 0 ? trimmedName : autoName).slice(
    0,
    NAME_MAX_LEN,
  );

  // 5. Coerce ISO dates → Date | undefined (createCampaignRecord
  // tolerates undefined for both endpoints).
  const startDateObj =
    input.startDate && /^\d{4}-\d{2}-\d{2}$/.test(input.startDate)
      ? new Date(input.startDate)
      : undefined;
  const endDateObj =
    input.endDate && /^\d{4}-\d{2}-\d{2}$/.test(input.endDate)
      ? new Date(input.endDate)
      : undefined;
  // Reject invalid Date objects (NaN getTime) silently — leave both
  // unset rather than persist garbage; UX-wise this matches BL-068's
  // silent-fallback ethos (§5 不变量 #4).
  const safeStart =
    startDateObj && !isNaN(startDateObj.getTime()) ? startDateObj : undefined;
  const safeEnd =
    endDateObj && !isNaN(endDateObj.getTime()) ? endDateObj : undefined;

  // 6. Validate currency code; budgetAmount must be > 0 to count.
  const currency =
    input.budget &&
    typeof input.budget.amount === "number" &&
    input.budget.amount > 0 &&
    typeof input.budget.currency === "string" &&
    CURRENCY_RE.test(input.budget.currency.toUpperCase())
      ? input.budget.currency.toUpperCase()
      : undefined;
  const budgetAmount =
    input.budget && typeof input.budget.amount === "number" && input.budget.amount > 0
      ? input.budget.amount
      : undefined;

  // 7. Dedupe + clamp categories; targetAudience already validated by
  // F002 parser but defensive-clamp anyway.
  const dedupedCategories = Array.from(
    new Set(
      (input.categories ?? []).filter(
        (c): c is string => typeof c === "string" && c.length > 0,
      ),
    ),
  );
  const trimmedAudience =
    typeof input.targetAudience === "string"
      ? input.targetAudience.slice(0, 500)
      : "";

  // 8. Delegate to BM2 sediment + F005 extras channel.
  try {
    const result = await createCampaignRecord(
      tenantId,
      {
        name: finalName,
        productId: input.productId,
        budgetAmount,
        startDate: safeStart,
        endDate: safeEnd,
        game: undefined,
        markets: normalizedMarkets,
        kpiTarget: undefined,
        ownerUserId: userId,
      },
      {
        budgetCurrency: currency,
        briefMeta: {
          targetAudience: trimmedAudience || undefined,
          categories: dedupedCategories,
        },
      },
    );
    return { ok: true, campaignId: result.id };
  } catch (err) {
    if (err instanceof CampaignCreateError) {
      if (err.code === "product_not_found") {
        return { ok: false, error: "product_not_found" };
      }
      return { ok: false, error: "internal_error" };
    }
    console.error("[createCampaignFromBriefAction] createCampaignRecord:", err);
    return { ok: false, error: "internal_error" };
  }
}
