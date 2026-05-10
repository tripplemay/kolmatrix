/**
 * BL-024-F001-2 — `/database` Import CSV.
 *
 * Accepts `multipart/form-data` with a single `file` field, parses it
 * as RFC-4180 CSV, validates each row with zod, and upserts into the
 * tenant's `Kol` table by `(tenantId, platform, externalId)`.
 *
 * Security/quotas:
 *   - 5 MB body cap (parsed file size, post-multipart-decoding)
 *   - withTenant + RLS — cross-tenant write impossible
 *   - rateLimitBatchSend(userId): 20 imports / minute / userId so a
 *     single operator can't DoS the DB with rapid re-imports
 *   - csv parser is dependency-free (`@/lib/csv/parse`); 5 MB × ~100 B
 *     row ≈ 50K rows max — fits in memory comfortably
 *
 * Wire shape (mirrors v0.9.11 §api-design.md envelope):
 *   { ok: true, importedCount, skippedCount, errors: ErrorEntry[] }
 *   { ok: false, error: <code>, retryAfter?: number }
 *
 * `errors` is capped at the first 10 entries so a 100% bad file
 * doesn't blow up the JSON payload. The dialog shows them inline.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { CsvParseError, parseCsv } from "@/lib/csv/parse";
import { withTenant } from "@/lib/db";
import { rateLimitBatchSend } from "@/lib/rate-limit-batch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 50_000;
const MAX_ERRORS_RETURNED = 10;

const PLATFORMS = [
  "youtube",
  "tiktok",
  "instagram",
  "twitch",
  "bilibili",
  "x",
  "manual",
] as const;

const RowSchema = z
  .object({
    external_id: z.string().min(1).max(120),
    platform: z.enum(PLATFORMS).default("manual"),
    handle: z.string().min(1).max(120),
    display_name: z.string().min(1).max(200),
    follower_count: z
      .string()
      .optional()
      .transform((v) => {
        if (!v) return 0;
        const n = Number.parseInt(v, 10);
        if (!Number.isFinite(n) || n < 0) return 0;
        return n;
      }),
    language: z.string().max(8).optional().default(""),
    country_code: z.string().max(8).optional().default(""),
    email: z
      .string()
      .optional()
      .transform((v) => (v ? v.trim() : ""))
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
        message: "invalid email",
      }),
    categories: z.string().optional().default(""),
  })
  .strip();

type ImportError = { row: number; message: string };

interface ImportResult {
  ok: true;
  importedCount: number;
  skippedCount: number;
  errors: ImportError[];
}

interface ImportFailure {
  ok: false;
  error: string;
  retryAfter?: number;
}

function jsonResp<T>(body: T, status: number): Response {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return jsonResp<ImportFailure>({ ok: false, error: "unauthorized" }, 401);
  }

  const rl = await rateLimitBatchSend(userId);
  if (!rl.ok) {
    return jsonResp<ImportFailure>(
      { ok: false, error: "rate_limit_exceeded", retryAfter: rl.retryAfter },
      429
    );
  }

  // multipart/form-data parse
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResp<ImportFailure>({ ok: false, error: "invalid_form_data" }, 400);
  }

  const fileEntry = form.get("file");
  if (!(fileEntry instanceof File)) {
    return jsonResp<ImportFailure>({ ok: false, error: "missing_file" }, 400);
  }

  if (fileEntry.size > MAX_FILE_BYTES) {
    return jsonResp<ImportFailure>(
      { ok: false, error: "file_too_large" },
      413
    );
  }

  const text = await fileEntry.text();
  // Defensive: re-check the post-decode byte length (browser can lie).
  if (Buffer.byteLength(text, "utf8") > MAX_FILE_BYTES) {
    return jsonResp<ImportFailure>(
      { ok: false, error: "file_too_large" },
      413
    );
  }

  let parsed;
  try {
    parsed = parseCsv(text);
  } catch (err) {
    if (err instanceof CsvParseError) {
      return jsonResp<ImportFailure>(
        { ok: false, error: `csv_parse_error_line_${err.line}` },
        400
      );
    }
    return jsonResp<ImportFailure>({ ok: false, error: "csv_parse_error" }, 400);
  }

  if (parsed.rows.length > MAX_ROWS) {
    return jsonResp<ImportFailure>({ ok: false, error: "too_many_rows" }, 413);
  }

  const errors: ImportError[] = [];
  let importedCount = 0;
  let skippedCount = 0;

  await withTenant(tenantId, async (tx) => {
    for (let idx = 0; idx < parsed.rows.length; idx += 1) {
      const csvRow = parsed.rows[idx];
      const rowNo = idx + 2; // human-readable: header is row 1

      const validation = RowSchema.safeParse(csvRow);
      if (!validation.success) {
        skippedCount += 1;
        if (errors.length < MAX_ERRORS_RETURNED) {
          errors.push({
            row: rowNo,
            message: validation.error.issues[0]?.message ?? "invalid",
          });
        }
        continue;
      }

      const r = validation.data;
      const categories = r.categories
        ? r.categories.split("|").map((s) => s.trim()).filter(Boolean)
        : [];

      try {
        await tx.kol.upsert({
          where: {
            tenantId_platform_externalId: {
              tenantId,
              platform: r.platform,
              externalId: r.external_id,
            },
          },
          create: {
            tenantId,
            platform: r.platform,
            externalId: r.external_id,
            handle: r.handle,
            displayName: r.display_name,
            followerCount: r.follower_count,
            language: r.language || null,
            countryCode: r.country_code || null,
            email: r.email || null,
            categories,
            metadata: {
              source: "manual-csv-import",
              imported_at: new Date().toISOString(),
              imported_by: userId,
            },
          },
          update: {
            handle: r.handle,
            displayName: r.display_name,
            followerCount: r.follower_count,
            language: r.language || null,
            countryCode: r.country_code || null,
            email: r.email || null,
            categories,
          },
        });
        importedCount += 1;
      } catch (err) {
        skippedCount += 1;
        if (errors.length < MAX_ERRORS_RETURNED) {
          errors.push({
            row: rowNo,
            message: (err as Error).message.slice(0, 200),
          });
        }
      }
    }
  });

  const out: ImportResult = {
    ok: true,
    importedCount,
    skippedCount,
    errors,
  };
  return jsonResp(out, 200);
}
