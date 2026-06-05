/**
 * B7a-F002 · Smart Match server logic.
 *
 * Given a (tenantId, productId) tuple, returns the top-N KOLs by
 * cosine similarity against the product's embedding vector. The
 * product is JIT-embedded if its embedding is NULL (audit lock #11:A
 * — first-time match latency ~300ms; cached after that).
 *
 * Performance budget (audit + spec §F002):
 *   - Cached path: < 100ms (mostly the cosine SQL + result hydration)
 *   - JIT-embed path: ~300ms (one aigcgateway call + DB write + SQL)
 *
 * RLS: every read happens inside `withTenant(tenantId, ...)` so the
 * cosine top-K query also auto-narrows to the tenant's own KOL set.
 */
import type { PrismaClient } from "@prisma/client";

import { embedProductIfStale } from "@/lib/embedding/kol-embed";
import type { EventData } from "@/lib/events/log";
import {
  vectorLiteral,
} from "@/lib/embedding/sql";
import { EMBEDDING_DIMS } from "@/lib/embedding/types";

// Lazy-imported to avoid touching db.ts at module load (db.ts throws
// when DATABASE_URL is unset, which breaks integration test setup
// order — `setupTestDb()` only runs in beforeAll, but module imports
// resolve earlier).
async function dbModule(): Promise<typeof import("@/lib/db")> {
  return import("@/lib/db");
}
async function dbAdminModule(): Promise<typeof import("@/lib/db-admin")> {
  return import("@/lib/db-admin");
}

/** Match score range (0–100) used by the UI RingProgress. */
export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

/**
 * Default top-K.
 *
 * BL-084-F001: bumped 10 → 30. The AI Match Panel recalls a wider pool
 * so the LLM rerank (F002) has 30 candidates to reorder + annotate. The
 * legacy B7a `/api/kols/smart-match` caller passes an explicit `topK`,
 * so this default change does not alter its behaviour.
 */
export const DEFAULT_TOP_K = 30;

export interface SmartMatchInput {
  tenantId: string;
  productId: string;
  /** Override top-K for tests / future Discover-style "show more". */
  topK?: number;
  /**
   * BL-084-F001: the campaign this match was invoked for. Purely
   * telemetry + downstream cache-key material (F004) — runSmartMatch
   * itself does NOT read it for filtering. Omitted from the
   * `smart_match.invoked` payload when not provided.
   */
  campaignId?: string;
  /**
   * BL-084-F001: the user that triggered the match, threaded through to
   * the `smart_match.invoked` telemetry actor. Optional so non-request
   * callers (cron / tests) can omit it.
   */
  actorId?: string;
  /** Inject a PrismaClient (tests), otherwise the lazy singleton is used. */
  prismaOverride?: PrismaClient;
}

/**
 * BL-084-F001: pure builder for the `smart_match.invoked` telemetry
 * event. Extracted so the campaignId-presence contract is unit-testable
 * without standing up a DB (runSmartMatch emits this via fire-and-forget
 * logEvent). campaignId is included in the payload only when provided.
 */
export function buildSmartMatchEvent(args: {
  tenantId: string;
  actorId?: string;
  productId: string;
  campaignId?: string;
  resultCount: number;
  durationMs: number;
  embeddedJustInTime: boolean;
}): EventData {
  return {
    type: "smart_match.invoked",
    tenantId: args.tenantId,
    actorId: args.actorId,
    resourceId: args.productId,
    payload: {
      topK: args.resultCount,
      durationMs: args.durationMs,
      embeddedJustInTime: args.embeddedJustInTime,
      ...(args.campaignId ? { campaignId: args.campaignId } : {}),
    },
  };
}

export interface SmartMatchKolHit {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
  followerCount: number;
  countryCode: string | null;
  categories: string[];
  /** Cosine distance from pgvector `<=>` operator, range [0, 2]. */
  distance: number;
  /** Cosine *similarity*, range [-1, 1]. */
  similarity: number;
  /** UI-friendly 0-100 score, derived from similarity. */
  matchScore: number;
  /**
   * BL-066-F003: surfaced so the AiRecommendationPanel C2 "Why we
   * suggest this" line ("matched on cosine similarity {matchScore};
   * valueScore {valueScore}") can render without a second round-trip.
   * Nullable because KOL.value_score is nullable in schema.prisma.
   */
  valueScore: number | null;
}

export interface SmartMatchProductBrief {
  id: string;
  name: string;
  category: string;
  /** Whether the product was embedded just-in-time during this call. */
  embeddedJustInTime: boolean;
}

export interface SmartMatchResult {
  product: SmartMatchProductBrief;
  results: SmartMatchKolHit[];
  /** Wall-clock latency in ms (logged for telemetry / acceptance). */
  durationMs: number;
}

export class SmartMatchError extends Error {
  constructor(
    public readonly code:
      | "product_not_found"
      | "embedding_failed"
      | "db_error",
    message: string
  ) {
    super(message);
    this.name = "SmartMatchError";
  }
}

/**
 * BL-023-F004: cosine similarity is `1 - distance` for the cosine ops
 * in pgvector; we map non-negative similarity directly to a 0-100 score
 * (negative cosine collapses to 0) for the UI ring.
 *
 * Visual contract: 0 = "no match at all", 100 = "perfect overlap".
 * The earlier `(sim+1)/2` mapping put orthogonal matches at 50 — that
 * misled marketers into reading "no match" as "moderate match", and
 * compressed real bge-m3 hits ([0.4, 0.85]) into a narrow [70, 92]
 * band. BL-044 cosine measurements (0.37-0.46 in semantic search)
 * confirmed the band collapse; the new mapping spreads them across
 * [37, 46] so the rank ordering stays the same but the absolute number
 * means what the user expects.
 */
export function similarityToScore(similarity: number): number {
  const positive = Math.max(0, Math.min(1, similarity));
  return Math.round(positive * MAX_SCORE);
}

/**
 * Run a Smart Match for one product. Throws SmartMatchError on
 * predictable failures (product missing, embedding gateway down). Any
 * other DB error is wrapped as `db_error`.
 */
export async function runSmartMatch(
  input: SmartMatchInput
): Promise<SmartMatchResult> {
  const startedAt = Date.now();
  const topK = input.topK ?? DEFAULT_TOP_K;

  const db = await dbModule();
  const { Prisma, withTenant } = db;

  // RLS-aware tenant validation lives on the app-role prisma, but the
  // embed UPDATE + vector readback need the admin client to bypass RLS
  // — UPDATE statements run without a tenant GUC otherwise affect 0
  // rows, and SELECT-by-id likewise returns 0 rows. The bug surfaced in
  // staging verifying-2026-04-28: 5/5 products returned
  // "product vector unreadable after embed" because the unscoped app
  // role couldn't see/touch its own row. We pre-validate tenant
  // ownership via withTenant findUnique below so admin access is safe.
  const prismaAdmin = (await dbAdminModule()).prismaAdmin;
  const prismaForEmbed = input.prismaOverride ?? prismaAdmin;

  let embeddedJustInTime = false;

  // 1. Resolve product & ensure embedding exists. The findUnique
  //    runs through withTenant, so RLS is the security boundary that
  //    proves the caller actually owns this product before we hand
  //    the id over to the admin-role embed/read path.
  // BL-051a-F007 — soft-deleted products are invisible to Smart
  // Match. findFirst layers deletedAt: null on top of the unique id.
  const product = await withTenant(input.tenantId, (tx) =>
    tx.product.findFirst({
      where: { id: input.productId, deletedAt: null },
      select: {
        id: true,
        name: true,
        category: true,
        embeddingTextHash: true,
      },
    })
  );
  if (!product) {
    throw new SmartMatchError("product_not_found", input.productId);
  }

  // 2. JIT-embed the product if needed. embedProductIfStale itself
  //    short-circuits when hash matches. Admin role so the UPDATE
  //    actually touches the row.
  const embedStats = await embedProductIfStale(prismaForEmbed, input.productId, {
    source: "product-jit",
  });
  if (embedStats.failed > 0 && embedStats.embedded === 0) {
    throw new SmartMatchError(
      "embedding_failed",
      `product embed failed for ${input.productId}`
    );
  }
  embeddedJustInTime = embedStats.embedded > 0;

  // 3. Fetch the now-guaranteed-non-null product vector via admin role
  //    so RLS doesn't hide it (caller already validated ownership).
  const productVecRow = await prismaForEmbed.$queryRawUnsafe<
    { vec: number[] | null }[]
  >(
    `SELECT (embedding::text)::jsonb AS vec
     FROM "product"
     WHERE id = $1`,
    input.productId
  );
  const rawVec = productVecRow[0]?.vec;
  if (!Array.isArray(rawVec) || rawVec.length !== EMBEDDING_DIMS) {
    throw new SmartMatchError(
      "embedding_failed",
      `product vector unreadable after embed (id=${input.productId})`
    );
  }
  // Coerce to number[] (jsonb may yield string-like numbers in some
  // drivers). pgvector outputs floats which jsonb preserves as numbers.
  const queryVec: number[] = rawVec.map((x) => Number(x));

  // 4. Cosine top-K, RLS-scoped. Use a parameterised raw query — the
  //    `<=>` operator takes a vector(1024) literal on the right side.
  //    excluding embedding-NULL rows (audit lock #11:A) + suspicious
  //    KOLs (B6 F005 isSuspicious flag, UI must hide them).
  const lit = vectorLiteral(queryVec);
  const dimsRaw = Prisma.raw(String(EMBEDDING_DIMS));
  const limitRaw = Prisma.raw(String(topK));

  let rows: Array<{
    id: string;
    display_name: string;
    handle: string;
    platform: string;
    avatar_url: string | null;
    follower_count: number;
    country_code: string | null;
    categories: string[];
    distance: number;
    value_score: number | null;
  }>;
  try {
    rows = await withTenant(input.tenantId, (tx) =>
      tx.$queryRaw(Prisma.sql`
        SELECT
          id,
          display_name,
          handle,
          platform,
          avatar_url,
          follower_count,
          country_code,
          categories,
          value_score,
          ("embedding" <=> ${lit}::vector(${dimsRaw})) AS distance
        FROM "kol"
        WHERE "embedding" IS NOT NULL
          AND "is_suspicious" = false
          AND "deleted_at" IS NULL
        ORDER BY distance ASC
        LIMIT ${limitRaw}
      `)
    );
  } catch (err) {
    throw new SmartMatchError(
      "db_error",
      `cosine top-K failed: ${(err as Error).message.slice(0, 120)}`
    );
  }

  const results: SmartMatchKolHit[] = rows.map((r) => {
    const distance = Number(r.distance);
    const similarity = 1 - distance; // pgvector cosine distance = 1 - sim
    return {
      id: r.id,
      displayName: r.display_name,
      handle: r.handle,
      platform: r.platform,
      avatarUrl: r.avatar_url,
      followerCount: r.follower_count,
      countryCode: r.country_code,
      categories: r.categories ?? [],
      distance,
      similarity,
      matchScore: similarityToScore(similarity),
      valueScore: r.value_score == null ? null : Number(r.value_score),
    };
  });

  const durationMs = Date.now() - startedAt;

  // BL-084-F001: emit `smart_match.invoked` from here (single emitter)
  // so every caller — the legacy /api/kols/smart-match route and the new
  // getCampaignSuggestions orchestrator — produces the same telemetry,
  // including campaignId when present. Fire-and-forget; logEvent already
  // swallows its own failures. Lazy-import keeps db.ts off the module
  // load path (see dbModule note above).
  const event = buildSmartMatchEvent({
    tenantId: input.tenantId,
    actorId: input.actorId,
    productId: input.productId,
    campaignId: input.campaignId,
    resultCount: results.length,
    durationMs,
    embeddedJustInTime,
  });
  void import("@/lib/events/log").then((m) => m.logEvent(event));

  return {
    product: {
      id: product.id,
      name: product.name,
      category: product.category,
      embeddedJustInTime,
    },
    results,
    durationMs,
  };
}
