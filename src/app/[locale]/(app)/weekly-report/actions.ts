"use server";

/**
 * BM2-F010 · /weekly-report Server Actions.
 *
 *   - generateWeeklyReportAction(weekStart, locale)
 *       → assemble data → call AI → upsert WeeklyReport row → return id
 *   - createShareTokenAction(reportId)
 *       → mint 32-char token + 7d expiry → return URL
 *
 * Telemetry: 5 event_log types per Planner §13.5 #10.
 */
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";
import {
  assembleWeeklyReportInput,
  isoWeekEndUtc,
  isoWeekStartUtc,
} from "@/lib/weekly-report/data-assembly";
import {
  WeeklyReportError,
  generateWeeklyReport,
} from "@/lib/weekly-report/generate";
import {
  attachShareToken,
  upsertWeeklyReport,
} from "@/lib/weekly-report/persistence";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GenerateWeeklyReportResult =
  | { ok: true; reportId: string; markdown: string }
  | { ok: false; error: string };

export async function generateWeeklyReportAction(
  weekStartIso: string,
  locale: "en" | "zh"
): Promise<GenerateWeeklyReportResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId) || !userId) {
    return { ok: false, error: "unauthorized" };
  }

  const parsedDate = weekStartIso ? new Date(weekStartIso) : new Date();
  if (Number.isNaN(parsedDate.getTime())) {
    return { ok: false, error: "invalid_input" };
  }
  const weekStart = isoWeekStartUtc(parsedDate);
  const weekEnd = isoWeekEndUtc(weekStart);

  void logEvent({
    type: "weekly_report.generate_clicked",
    tenantId,
    actorId: userId,
    payload: { weekStart: weekStart.toISOString().slice(0, 10), locale },
  });

  // Tenant snapshot for the branded header — fetched inside the same
  // tenant transaction the data assembly uses.
  const tenant = await withTenant(tenantId, async (tx) =>
    tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logoUrl: true },
    })
  );
  if (!tenant) {
    return { ok: false, error: "unauthorized" };
  }

  let assembled;
  try {
    assembled = await assembleWeeklyReportInput({
      tenantId,
      weekStart,
      weekEnd,
    });
  } catch (err) {
    void logEvent({
      type: "weekly_report.generated_failed",
      tenantId,
      actorId: userId,
      payload: { code: "data_assembly_failed", message: (err as Error).message },
    });
    return { ok: false, error: "data_assembly_failed" };
  }

  let report;
  try {
    report = await generateWeeklyReport({
      tenant,
      weekStart,
      weekEnd,
      locale,
      kolActivity: assembled.kolActivity,
      roiData: assembled.roiData,
      prevWeekComparison: assembled.prevWeekComparison,
    });
  } catch (err) {
    const code = err instanceof WeeklyReportError ? err.code : "generic";
    void logEvent({
      type: "weekly_report.generated_failed",
      tenantId,
      actorId: userId,
      payload: { code },
    });
    return { ok: false, error: code };
  }

  const row = await upsertWeeklyReport({
    tenantId,
    createdByUserId: userId,
    weekStart,
    weekEnd,
    locale,
    contentMd: report.markdown,
    summaryJson: {
      tenantSnapshot: { name: tenant.name, logoUrl: tenant.logoUrl },
      kolActivity: assembled.kolActivity,
      roiData: assembled.roiData,
      prevWeekComparison: assembled.prevWeekComparison,
      generatedAt: new Date().toISOString(),
      traceId: report.traceId,
      cost: report.cost,
    },
  });

  void logEvent({
    type: "weekly_report.generated",
    tenantId,
    actorId: userId,
    resourceId: row.id,
    payload: {
      traceId: report.traceId ?? null,
      cost: report.cost ?? null,
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      locale,
    },
  });

  revalidatePath("/[locale]/weekly-report", "page");

  return { ok: true, reportId: row.id, markdown: report.markdown };
}

export type CreateShareTokenResult =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; error: string };

export async function createShareTokenAction(
  reportId: string,
  origin: string
): Promise<CreateShareTokenResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId) || !userId) {
    return { ok: false, error: "unauthorized" };
  }
  if (!UUID_RE.test(reportId)) {
    return { ok: false, error: "invalid_input" };
  }

  let token: string;
  let expiresAt: Date;
  try {
    const minted = await attachShareToken({ tenantId, reportId });
    token = minted.token;
    expiresAt = minted.expiresAt;
  } catch (err) {
    void logEvent({
      type: "weekly_report.share_token_failed",
      tenantId,
      actorId: userId,
      resourceId: reportId,
      payload: { message: (err as Error).message },
    });
    return { ok: false, error: "generic" };
  }

  void logEvent({
    type: "weekly_report.share_token_created",
    tenantId,
    actorId: userId,
    resourceId: reportId,
    payload: { expiresAt: expiresAt.toISOString() },
  });

  // Trim trailing slash to keep the URL canonical regardless of caller.
  const cleanOrigin = origin.replace(/\/+$/, "");
  return {
    ok: true,
    url: `${cleanOrigin}/shared/weekly-report/${token}`,
    expiresAt: expiresAt.toISOString(),
  };
}
