"use server";

/**
 * BL-068-F002 · Server action for the conversational refine layer.
 *
 * `applyRefineAction` takes a user's natural-language refine query plus
 * the current top-30 KOL pool (IDs only — server re-fetches metadata via
 * RLS so the LLM input cannot be tampered from the client) and returns
 * a reordered pool + 5-locale feedback. Per spec §5 不变量 #5 the action
 * always returns a usable pool; cap-exhausted / unparsable / permutation-
 * invalid all fall back to the unchanged input pool with a status flag
 * so the UI can surface the appropriate toast.
 *
 * Flow (per docs/specs/BL-068-F001-prompt-design.md §4):
 *   1. Session + UUID/locale/rawQuery/pool validation
 *   2. rateLimitBatchSend (20/min/user, shared with outreach + BL-067)
 *   3. checkLlmCostBudget → cap exhausted: audit `refine_cap_exhausted`,
 *      return capExhausted=true (silent fallback per §5 #5)
 *   4. Re-fetch pool via withTenant (RLS); bail if any ID outside tenant
 *   5. wrapUserInput on raw_query + current_pool_json (per
 *      framework/harness/ai-action-contract.md §4 XML-escape contract)
 *   6. runAigcAction → catch race-condition AiDailyCostExceededError →
 *      same fallback as step 3
 *   7. Parse output, branch:
 *        - LLM unparsable: audit `refine_unparsable`, return unparsable=true
 *          with reason_locale[locale] as feedback
 *        - malformed (missing ordered_kol_ids): audit `refine_parse_failed`,
 *          return unparsable=true with no feedback
 *        - permutation invalid (extra / missing / duplicate IDs): audit
 *          `refine_permutation_invalid`, return unparsable=true with no
 *          feedback so F005 client UI can surface i18n permutationInvalid
 *        - success: audit `refine_applied` (includes raw_query +
 *          parsed_filters + result_kol_ids per §5 不变量 #6 — Phase 5
 *          personalization training data), return reordered IDs + feedback
 */

import { auth } from "@/auth";
import { runAigcAction, AiDailyCostExceededError } from "@/lib/aigc/run-action";
import { wrapUserInput } from "@/lib/ai/xml-escape";
import { checkLlmCostBudget } from "@/lib/ai/cost-cap";
import { logAudit } from "@/lib/audit/log";
import { withTenant } from "@/lib/db";
import { rateLimitBatchSend } from "@/lib/rate-limit-batch";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES_ALL = ["en", "zh", "ja", "ko", "es"] as const;
const LOCALES = new Set<string>(LOCALES_ALL);
type Locale = (typeof LOCALES_ALL)[number];

// Pool size guard: 30 expected per spec, allow 1-60 for headroom (e.g.
// users accepting / skipping reduces visible pool but the underlying
// fetched pool is still ≤ TOP_K=30; 60 leaves slack for future top-K
// changes without code edits).
const POOL_MIN = 1;
const POOL_MAX = 60;
const RAW_QUERY_MAX_LEN = 500;

export type RefineActionError =
  | "unauthorized"
  | "validation_failed"
  | "rate_limit_exceeded"
  | "internal_error";

export interface ApplyRefineInput {
  campaignId: string;
  rawQuery: string;
  /** UUID list of the current visible pool (server re-fetches metadata). */
  currentPoolIds: string[];
  locale: string;
}

export interface ApplyRefineSuccessData {
  /** Strict permutation of `currentPoolIds` — on any failure mode, equals input. */
  orderedKolIds: string[];
  /** LLM feedback for the caller's locale, or "" when no feedback applies. */
  feedback: string;
  /** True when LLM declined to parse, permutation invalid, or output malformed. */
  unparsable: boolean;
  /** True when cost-cap blocked the call (pre-check or in-flight race). */
  capExhausted: boolean;
}

export type ApplyRefineActionResult =
  | { ok: true; data: ApplyRefineSuccessData }
  | { ok: false; error: RefineActionError; retryAfter?: number };

interface PoolKol {
  id: string;
  name: string;
  handle: string;
  platform: string;
  followerCount: number;
  engagementRate: number | null;
  categories: string[];
}

interface RefineLlmOutput {
  unparsable?: boolean;
  ordered_kol_ids?: unknown;
  parsed_filters?: unknown;
  feedback_summary?: unknown;
  reason_locale?: unknown;
}

/**
 * Apply a natural-language refine query to the current 30-KOL pool.
 * Never throws — all error modes map to either an error result or a
 * silent-fallback success with the original pool order.
 */
export async function applyRefineAction(
  input: ApplyRefineInput,
): Promise<ApplyRefineActionResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId) || !userId || !UUID_RE.test(userId)) {
    return { ok: false, error: "unauthorized" };
  }

  // Input validation — fail fast before any DB / LLM cost
  if (!UUID_RE.test(input.campaignId)) {
    return { ok: false, error: "validation_failed" };
  }
  if (!LOCALES.has(input.locale)) {
    return { ok: false, error: "validation_failed" };
  }
  const locale = input.locale as Locale;
  if (
    typeof input.rawQuery !== "string" ||
    input.rawQuery.trim().length === 0 ||
    input.rawQuery.length > RAW_QUERY_MAX_LEN
  ) {
    return { ok: false, error: "validation_failed" };
  }
  if (
    !Array.isArray(input.currentPoolIds) ||
    input.currentPoolIds.length < POOL_MIN ||
    input.currentPoolIds.length > POOL_MAX
  ) {
    return { ok: false, error: "validation_failed" };
  }
  for (const id of input.currentPoolIds) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return { ok: false, error: "validation_failed" };
    }
  }
  if (new Set(input.currentPoolIds).size !== input.currentPoolIds.length) {
    return { ok: false, error: "validation_failed" };
  }

  // Rate limit — per spec §F002 acceptance + BL-067 F004 pattern.
  const rl = await rateLimitBatchSend(userId);
  if (!rl.ok) {
    return {
      ok: false,
      error: "rate_limit_exceeded",
      retryAfter: rl.retryAfter,
    };
  }

  // Cost-cap pre-check — silent fallback per spec §5 不变量 #5.
  const budget = await checkLlmCostBudget(tenantId);
  if (!budget.allowed) {
    void logAudit({
      actorId: userId,
      action: "ai_recommendation.refine_cap_exhausted",
      targetType: "campaign",
      targetId: input.campaignId,
      tenantId,
      after: {
        raw_query: input.rawQuery,
        locale,
        pool_size: input.currentPoolIds.length,
      },
    });
    return {
      ok: true,
      data: {
        orderedKolIds: input.currentPoolIds,
        feedback: "",
        unparsable: false,
        capExhausted: true,
      },
    };
  }

  // Re-fetch pool metadata via RLS — never trust client-passed KOL fields
  // for LLM input.
  let pool: PoolKol[];
  try {
    pool = await withTenant(tenantId, async (tx) => {
      const rows = await tx.kol.findMany({
        where: { id: { in: input.currentPoolIds } },
        select: {
          id: true,
          displayName: true,
          handle: true,
          platform: true,
          followerCount: true,
          engagementRate: true,
          categories: true,
        },
      });
      return rows.map((row: {
        id: string;
        displayName: string;
        handle: string;
        platform: string;
        followerCount: number;
        engagementRate: { toNumber: () => number } | null;
        categories: string[];
      }) => ({
        id: row.id,
        name: row.displayName,
        handle: row.handle,
        platform: row.platform,
        followerCount: row.followerCount,
        engagementRate:
          row.engagementRate == null ? null : row.engagementRate.toNumber(),
        categories: row.categories,
      }));
    });
  } catch (err) {
    console.error("[applyRefineAction] pool fetch error:", err);
    return { ok: false, error: "internal_error" };
  }

  if (pool.length !== input.currentPoolIds.length) {
    // Some IDs are outside tenant — bail without surfacing presence info.
    return { ok: false, error: "validation_failed" };
  }

  // Re-order to match input order (Prisma findMany returns DB order).
  const idIndex = new Map(
    input.currentPoolIds.map((id, idx) => [id, idx]),
  );
  pool.sort(
    (a, b) => (idIndex.get(a.id) ?? 0) - (idIndex.get(b.id) ?? 0),
  );

  const actionId = process.env.AIGCGATEWAY_REFINE_ACTION_ID;
  if (!actionId) {
    console.error(
      "[applyRefineAction] AIGCGATEWAY_REFINE_ACTION_ID not configured",
    );
    return { ok: false, error: "internal_error" };
  }

  const variables: Record<string, string> = {
    raw_query: wrapUserInput("USER_RAW_QUERY", input.rawQuery),
    current_pool_json: wrapUserInput(
      "USER_CURRENT_POOL_JSON",
      JSON.stringify(pool),
    ),
    user_locale: locale,
  };

  let llmResult: Awaited<ReturnType<typeof runAigcAction<RefineLlmOutput>>>;
  try {
    llmResult = await runAigcAction<RefineLlmOutput>({
      actionId,
      variables,
      tenantId,
      actionLabel: "ai_recommendation_refine",
      timeoutMs: 30_000,
    });
  } catch (err) {
    if (err instanceof AiDailyCostExceededError) {
      void logAudit({
        actorId: userId,
        action: "ai_recommendation.refine_cap_exhausted",
        targetType: "campaign",
        targetId: input.campaignId,
        tenantId,
        after: {
          raw_query: input.rawQuery,
          locale,
          race_condition: true,
        },
      });
      return {
        ok: true,
        data: {
          orderedKolIds: input.currentPoolIds,
          feedback: "",
          unparsable: false,
          capExhausted: true,
        },
      };
    }
    console.error("[applyRefineAction] LLM call failed:", err);
    return { ok: false, error: "internal_error" };
  }

  const parsed = llmResult.output;
  const traceId = llmResult.traceId;

  // Branch 1: LLM declined to parse.
  if (parsed?.unparsable === true) {
    const reason = readLocaleString(parsed.reason_locale, locale);
    void logAudit({
      actorId: userId,
      action: "ai_recommendation.refine_unparsable",
      targetType: "campaign",
      targetId: input.campaignId,
      tenantId,
      after: {
        raw_query: input.rawQuery,
        locale,
        traceId,
      },
    });
    return {
      ok: true,
      data: {
        orderedKolIds: input.currentPoolIds,
        feedback: reason,
        unparsable: true,
        capExhausted: false,
      },
    };
  }

  // Branch 2: malformed output (missing or invalid ordered_kol_ids).
  if (
    !Array.isArray(parsed?.ordered_kol_ids) ||
    parsed.ordered_kol_ids.some((id) => typeof id !== "string")
  ) {
    void logAudit({
      actorId: userId,
      action: "ai_recommendation.refine_parse_failed",
      targetType: "campaign",
      targetId: input.campaignId,
      tenantId,
      after: {
        raw_query: input.rawQuery,
        locale,
        traceId,
      },
    });
    return {
      ok: true,
      data: {
        orderedKolIds: input.currentPoolIds,
        feedback: "",
        unparsable: true,
        capExhausted: false,
      },
    };
  }

  // Branch 3: permutation validation (strict same-set + no dupes + same length).
  const returnedIds = parsed.ordered_kol_ids as string[];
  const expectedSet = new Set(input.currentPoolIds);
  const returnedSet = new Set(returnedIds);
  const isPermutation =
    returnedIds.length === input.currentPoolIds.length &&
    returnedSet.size === returnedIds.length &&
    [...expectedSet].every((id) => returnedSet.has(id));
  if (!isPermutation) {
    const missing = [...expectedSet].filter((id) => !returnedSet.has(id));
    const extra = returnedIds.filter((id) => !expectedSet.has(id));
    void logAudit({
      actorId: userId,
      action: "ai_recommendation.refine_permutation_invalid",
      targetType: "campaign",
      targetId: input.campaignId,
      tenantId,
      after: {
        raw_query: input.rawQuery,
        locale,
        expected_count: input.currentPoolIds.length,
        returned_count: returnedIds.length,
        missing_ids: missing,
        extra_ids: extra,
        traceId,
      },
    });
    return {
      ok: true,
      data: {
        orderedKolIds: input.currentPoolIds,
        feedback: "",
        unparsable: true,
        capExhausted: false,
      },
    };
  }

  // Branch 4: success.
  const feedback = readLocaleString(parsed.feedback_summary, locale);
  void logAudit({
    actorId: userId,
    action: "ai_recommendation.refine_applied",
    targetType: "campaign",
    targetId: input.campaignId,
    tenantId,
    after: {
      raw_query: input.rawQuery,
      parsed_filters: parsed.parsed_filters ?? null,
      result_kol_ids: returnedIds,
      locale,
      token_usage: llmResult.usage.totalTokens,
      cost_usd: llmResult.usage.costUsd,
      traceId,
    },
  });
  return {
    ok: true,
    data: {
      orderedKolIds: returnedIds,
      feedback,
      unparsable: false,
      capExhausted: false,
    },
  };
}

/**
 * Safely extract `obj[locale]` as a string. LLM output structure is
 * untrusted JSON — any shape mismatch collapses to "" so the UI gets
 * a clean fallback instead of `[object Object]` style leakage.
 */
function readLocaleString(obj: unknown, locale: Locale): string {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "";
  const value = (obj as Record<string, unknown>)[locale];
  return typeof value === "string" ? value : "";
}
