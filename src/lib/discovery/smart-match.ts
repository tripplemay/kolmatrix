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

/** Default top-K (spec §F002 = 10). */
export const DEFAULT_TOP_K = 10;

export interface SmartMatchInput {
  tenantId: string;
  productId: string;
  /** Override top-K for tests / future Discover-style "show more". */
  topK?: number;
  /** Inject a PrismaClient (tests), otherwise the lazy singleton is used. */
  prismaOverride?: PrismaClient;
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
  const product = await withTenant(input.tenantId, (tx) =>
    tx.product.findUnique({
      where: { id: input.productId },
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
    };
  });

  return {
    product: {
      id: product.id,
      name: product.name,
      category: product.category,
      embeddedJustInTime,
    },
    results,
    durationMs: Date.now() - startedAt,
  };
}
