"use server";

/**
 * BM2-F006 · /outreach Server Actions.
 *
 * Four entry points that back the composer UI:
 *   - customizeAction: AI-rewrite a template for a specific KOL
 *   - updateKolEmailAction: inline fix-up of a KOL's missing email
 *   - sendBatchAction: actually send the batch via Resend / mock
 *     fallback with the server-side throttle
 *   - analyticsAction: used by integration tests to surface cached
 *     analytics (the RSC already computes these at render time)
 */
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";
import { jobQueue } from "@/lib/jobs/queue";
import { SEND_BATCH_MAX } from "@/lib/email/batch-constants";
import {
  SEND_EMAIL_BATCH_JOB,
  type SendEmailBatchPayload,
} from "@/lib/email/send-batch-worker";
import {
  CustomizeEmailError,
  customizeEmail,
  type CustomizeEmailResult,
} from "@/lib/email/customize";
import {
  createUserTemplate,
  deleteUserTemplate,
  duplicateUserTemplate,
  updateUserTemplate,
  type EmailTemplateDraftInput,
  type EmailTemplateOption,
} from "@/lib/email/templates";
import {
  batchSendOutreach,
  type BatchSendItem,
  type BatchSendResult,
} from "@/lib/email/batch-send";
import { substituteSubjectAndBody } from "@/lib/email/variable-substitute";
import { getEmailTemplateById } from "@/lib/assets/queries";
import { rateLimitBatchSend } from "@/lib/rate-limit-batch";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ComposerActionState<T = undefined> = {
  ok: boolean;
  error?: string;
} & (T extends undefined ? { data?: undefined } : { data?: T });

async function requireSession() {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId) || !userId || !UUID_RE.test(userId)) {
    return null;
  }
  return { tenantId, userId, marketerName: session!.user!.name ?? "Marketer" };
}

// --- AI customize -----------------------------------------------------

const customizeSchema = z.object({
  campaignId: z.string().regex(UUID_RE),
  kolId: z.string().regex(UUID_RE),
  templateId: z.string().regex(UUID_RE),
});

export async function customizeAction(
  _prev: ComposerActionState<CustomizeEmailResult>,
  formData: FormData
): Promise<ComposerActionState<CustomizeEmailResult>> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };

  const raw = {
    campaignId: String(formData.get("campaignId") ?? ""),
    kolId: String(formData.get("kolId") ?? ""),
    templateId: String(formData.get("templateId") ?? ""),
  };
  const parsed = customizeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  void logEvent({
    type: "email.ai_customize_clicked",
    tenantId: session.tenantId,
    actorId: session.userId,
    resourceId: parsed.data.kolId,
    payload: {
      campaignId: parsed.data.campaignId,
      templateId: parsed.data.templateId,
    },
  });

  // Resolve the inputs we need to hand to the aigcgateway action.
  const inputs = await withTenant(session.tenantId, async (tx) => {
    const [campaign, kol, template] = await Promise.all([
      tx.campaign.findUnique({
        where: { id: parsed.data.campaignId },
        select: {
          product: {
            select: {
              name: true,
              category: true,
              uniqueSellingPoints: true,
            },
          },
        },
      }),
      tx.kol.findUnique({
        where: { id: parsed.data.kolId },
        select: {
          displayName: true,
          handle: true,
          countryCode: true,
          categories: true,
        },
      }),
      // BL-098-F001 — resolve the template against the unified Asset
      // table (the dropdown hands out asset ids), not the deprecated
      // email_template table. Pure-Asset templates have no
      // email_template row → the old findUnique returned null →
      // "模板不存在" for every Asset-only template.
      getEmailTemplateById(tx, parsed.data.templateId),
    ]);
    return { campaign, kol, template };
  });

  // Differentiate the four "missing prerequisite" cases so the user
  // gets a useful error message. Reviewer 2026-05-01 prod L2 smoke C-10
  // hit the campaign_no_product path because seed campaigns weren't
  // linked to Products; the old undifferentiated "Campaign or template
  // not found" hid the real issue.
  if (!inputs.campaign) {
    return { ok: false, error: "campaign_not_found" };
  }
  if (!inputs.campaign.product) {
    return { ok: false, error: "campaign_no_product" };
  }
  if (!inputs.kol) {
    return { ok: false, error: "kol_not_found" };
  }
  if (!inputs.template) {
    return { ok: false, error: "template_not_found" };
  }

  try {
    const result = await customizeEmail({
      // BL-034 F005 fix-round 1: pass tenantId so customizeEmail can
      // pre-check the per-tenant daily AI cost cap + meter the call.
      tenantId: session.tenantId,
      product: {
        name: inputs.campaign.product.name,
        category: inputs.campaign.product.category,
        usp: inputs.campaign.product.uniqueSellingPoints,
      },
      kol: {
        name: inputs.kol.displayName,
        handle: inputs.kol.handle,
        region: inputs.kol.countryCode,
        categories: inputs.kol.categories,
      },
      template: {
        subject: inputs.template.subject,
        body: inputs.template.body,
        locale: (inputs.template.locale === "zh" ? "zh" : "en") as "en" | "zh",
      },
    });
    return { ok: true, data: result };
  } catch (err) {
    if (err instanceof CustomizeEmailError) {
      return { ok: false, error: err.code };
    }
    return { ok: false, error: "generic" };
  }
}

// --- Inline "add email" ----------------------------------------------

const patchEmailSchema = z.object({
  kolId: z.string().regex(UUID_RE),
  email: z
    .string()
    .trim()
    .max(320)
    .refine((v) => /^.+@.+\..+$/.test(v), { message: "email_invalid" }),
});

export async function updateKolEmailAction(
  _prev: ComposerActionState,
  formData: FormData
): Promise<ComposerActionState> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };

  const parsed = patchEmailSchema.safeParse({
    kolId: String(formData.get("kolId") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "invalid_input";
    return { ok: false, error: msg };
  }

  try {
    const updated = await withTenant(session.tenantId, async (tx) => {
      return tx.kol.update({
        where: { id: parsed.data.kolId },
        data: { email: parsed.data.email, emailSource: "manual" },
        select: { id: true },
      });
    });
    void logEvent({
      type: "kol.email_updated",
      tenantId: session.tenantId,
      actorId: session.userId,
      resourceId: updated.id,
      payload: { email: parsed.data.email, emailSource: "manual" },
    });
  } catch {
    return { ok: false, error: "db_error" };
  }

  revalidatePath("/[locale]/reach", "page");
  return { ok: true };
}

// --- Batch send ------------------------------------------------------

// BL-100-F003 (ADR-020 D3): sending is now async — sendBatchAction
// enqueues one BullMQ job and returns a batchId immediately, so the old
// BL-035-F008 8-cap + 60s wall-clock race are gone. The cap (now in
// batch-constants.ts) only bounds a single job's size; the throttle
// sleep lives in the worker.

const sendBatchSchema = z.object({
  campaignId: z.string().regex(UUID_RE),
  aiAccepted: z.boolean().default(false),
  items: z
    .array(
      z.object({
        kolId: z.string().regex(UUID_RE),
        toAddress: z.string().email(),
        subject: z.string().min(1),
        bodyText: z.string().min(1),
        templateId: z.string().regex(UUID_RE).nullable().optional(),
        aiCustomized: z.boolean().optional(),
      })
    )
    .min(1)
    .max(SEND_BATCH_MAX),
});

export type SendBatchInput = z.infer<typeof sendBatchSchema>;

/**
 * BL-100-F003 (ADR-020 D3) — batch send result.
 *
 * `mode: "async"` → the batch was enqueued; the UI polls
 * getSendBatchStatus(batchId) for progress. `mode: "sync"` → D5 fallback
 * (Redis unreachable): the batch ran inline and `data` carries the final
 * counts so the UI can render the summary without polling.
 */
export type SendBatchActionResult = {
  ok: boolean;
  error?: string;
  retryAfter?: number;
  batchId?: string;
  total?: number;
  mode?: "async" | "sync";
  data?: BatchSendResult;
};

export async function sendBatchAction(
  input: SendBatchInput
): Promise<SendBatchActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };

  const parsed = sendBatchSchema.safeParse(input);
  if (!parsed.success) {
    // Surface the cap explicitly so the UI can show "split into smaller
    // batches" copy instead of a generic "invalid_input" toast.
    const tooLarge = parsed.error.issues.some(
      (issue) =>
        issue.path.length >= 1 &&
        issue.path[0] === "items" &&
        (("code" in issue && issue.code === "too_big") ||
          /at most|too_big|max/i.test(issue.message)),
    );
    return {
      ok: false,
      error: tooLarge ? "batch_too_large" : "invalid_input",
    };
  }

  // BL-035-F003: per-user batch send rate limit (20/min/userId).
  // userId-keyed because sender reputation is account-scoped, not
  // tenant-scoped.
  const rl = await rateLimitBatchSend(session.userId);
  if (!rl.ok) {
    return { ok: false, error: "rate_limit_exceeded", retryAfter: rl.retryAfter };
  }

  if (parsed.data.aiAccepted) {
    void logEvent({
      type: "email.ai_customize_accepted",
      tenantId: session.tenantId,
      actorId: session.userId,
      resourceId: parsed.data.campaignId,
      payload: { items: parsed.data.items.length },
    });
  }

  const items: BatchSendItem[] = parsed.data.items.map((i) => ({
    kolCampaignId: "", // resolved inside batch helper; unused in F006
    kolId: i.kolId,
    toAddress: i.toAddress,
    subject: i.subject,
    bodyText: i.bodyText,
    templateId: i.templateId ?? null,
    aiCustomized: i.aiCustomized ?? false,
  }));

  const batchId = randomUUID();
  const total = items.length;
  const payload: SendEmailBatchPayload = {
    tenantId: session.tenantId,
    userId: session.userId,
    campaignId: parsed.data.campaignId,
    items,
    batchId,
  };

  // Async path: enqueue and return immediately. The throttled send runs
  // in the in-process worker; the UI polls getSendBatchStatus(batchId).
  try {
    await jobQueue.add<SendEmailBatchPayload>(SEND_EMAIL_BATCH_JOB, payload, {
      idempotencyKey: batchId,
      tenantId: session.tenantId,
    });
    return { ok: true, batchId, total, mode: "async" };
  } catch (enqueueErr) {
    // D5 (ADR-020): Redis unreachable → fall back to a synchronous send
    // (old behaviour, small batches still go out) using the SAME batchId
    // so email_log rows + (batchId,kolId) idempotency stay consistent if
    // the abandoned enqueue ever lands.
    console.error(
      "[sendBatchAction] enqueue failed; falling back to sync send:",
      enqueueErr,
    );
    let result: BatchSendResult;
    try {
      result = await batchSendOutreach(
        session.tenantId,
        session.userId,
        parsed.data.campaignId,
        items,
        batchId,
        { skipSleep: false },
      );
    } catch (sendErr) {
      console.error("[sendBatchAction] sync fallback failed:", sendErr);
      return { ok: false, error: "db_error" };
    }
    revalidatePath("/[locale]/reach", "page");
    revalidatePath(`/[locale]/campaigns/${parsed.data.campaignId}`, "page");
    return { ok: true, batchId, total, mode: "sync", data: result };
  }
}

/**
 * BL-100-F003 (ADR-020 D3) — poll the progress of an async send batch.
 *
 * Counts the email_log rows written so far for the batch (tenant-scoped
 * via withTenant). `processed` is sent + mockSent + failed; the UI knows
 * the intended `total` from the sendBatchAction response and renders
 * pending = total - processed.
 */
export interface SendBatchStatusCounts {
  sent: number;
  mockSent: number;
  failed: number;
  processed: number;
}

export type GetSendBatchStatusResult =
  | { ok: false; error: string }
  | { ok: true; counts: SendBatchStatusCounts };

export async function getSendBatchStatus(
  batchId: string,
): Promise<GetSendBatchStatusResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (typeof batchId !== "string" || !UUID_RE.test(batchId)) {
    return { ok: false, error: "invalid_input" };
  }

  try {
    const grouped = await withTenant(session.tenantId, (tx) =>
      tx.emailLog.groupBy({
        by: ["status"],
        where: { tenantId: session.tenantId, batchId },
        _count: { _all: true },
      }),
    );

    let sent = 0;
    let mockSent = 0;
    let failed = 0;
    for (const row of grouped) {
      const n = row._count._all;
      if (row.status === "sent") sent = n;
      else if (row.status === "mock_sent") mockSent = n;
      else if (row.status === "failed") failed = n;
    }

    return {
      ok: true,
      counts: { sent, mockSent, failed, processed: sent + mockSent + failed },
    };
  } catch (err) {
    console.error("[getSendBatchStatus] failed:", err);
    return { ok: false, error: "db_error" };
  }
}

// --- Template library ------------------------------------------------

const templateDraftSchema = z.object({
  templateId: z.string().regex(UUID_RE).optional(),
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(240),
  body: z.string().min(1),
  locale: z.enum(["en", "zh"]),
  variables: z.string().optional().default("[]"),
  sourceTemplateId: z.string().regex(UUID_RE).optional(),
});

export type TemplateMutationResult = EmailTemplateOption;

function parseVariables(raw: string): EmailTemplateDraftInput["variables"] {
  try {
    const parsed = JSON.parse(raw);
    return parsed as EmailTemplateDraftInput["variables"];
  } catch {
    return [];
  }
}

export async function saveTemplateAction(
  _prev: ComposerActionState<TemplateMutationResult>,
  formData: FormData
): Promise<ComposerActionState<TemplateMutationResult>> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };

  const parsed = templateDraftSchema.safeParse({
    templateId: String(formData.get("templateId") ?? "") || undefined,
    name: String(formData.get("name") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
    locale: String(formData.get("locale") ?? ""),
    variables: String(formData.get("variables") ?? "[]"),
    sourceTemplateId: String(formData.get("sourceTemplateId") ?? "") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const draft: EmailTemplateDraftInput = {
    name: parsed.data.name,
    subject: parsed.data.subject,
    body: parsed.data.body,
    locale: parsed.data.locale,
    variables: parseVariables(parsed.data.variables),
  };

  let template: TemplateMutationResult | null = null;
  let mutation: "created" | "updated" = "created";

  try {
    template = await withTenant(session.tenantId, async (tx) => {
      if (parsed.data.templateId) {
        const updated = await updateUserTemplate(
          tx,
          session.tenantId,
          parsed.data.templateId,
          draft
        );
        if (updated) mutation = "updated";
        return updated;
      }
      return createUserTemplate(tx, session.tenantId, draft);
    });
  } catch {
    return { ok: false, error: "db_error" };
  }

  if (!template) return { ok: false, error: "not_found" };

  void logEvent({
    type: `email.template_${mutation}`,
    tenantId: session.tenantId,
    actorId: session.userId,
    resourceId: template.id,
    payload: {
      locale: template.locale,
      sourceTemplateId: parsed.data.sourceTemplateId ?? null,
      templateType: template.type,
    },
  });

  void revalidatePath("/[locale]/reach", "page");
  void revalidatePath("/[locale]/reach/templates", "page");
  return { ok: true, data: template };
}

export async function duplicateTemplateAction(
  _prev: ComposerActionState<TemplateMutationResult>,
  formData: FormData
): Promise<ComposerActionState<TemplateMutationResult>> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };

  const templateId = String(formData.get("templateId") ?? "");
  if (!UUID_RE.test(templateId)) return { ok: false, error: "invalid_input" };

  let template: TemplateMutationResult | null = null;
  try {
    template = await withTenant(session.tenantId, async (tx) =>
      duplicateUserTemplate(tx, session.tenantId, templateId)
    );
  } catch {
    return { ok: false, error: "db_error" };
  }
  if (!template) return { ok: false, error: "not_found" };

  void logEvent({
    type: "email.template_duplicated",
    tenantId: session.tenantId,
    actorId: session.userId,
    resourceId: template.id,
    payload: { templateId },
  });

  void revalidatePath("/[locale]/reach", "page");
  void revalidatePath("/[locale]/reach/templates", "page");
  return { ok: true, data: template };
}

export async function deleteTemplateAction(
  _prev: ComposerActionState,
  formData: FormData
): Promise<ComposerActionState> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };

  const templateId = String(formData.get("templateId") ?? "");
  if (!UUID_RE.test(templateId)) return { ok: false, error: "invalid_input" };

  let deleted = false;
  try {
    deleted = await withTenant(session.tenantId, async (tx) =>
      deleteUserTemplate(tx, session.tenantId, templateId)
    );
  } catch {
    return { ok: false, error: "db_error" };
  }
  if (!deleted) return { ok: false, error: "not_found" };

  void logEvent({
    type: "email.template_deleted",
    tenantId: session.tenantId,
    actorId: session.userId,
    resourceId: templateId,
  });

  void revalidatePath("/[locale]/reach", "page");
  void revalidatePath("/[locale]/reach/templates", "page");
  return { ok: true };
}

// Re-export the pure substituter for client components (they can't
// import `@/lib/email/variable-substitute` directly because it lives
// outside the app directory; this wrapper fixes the server/client
// boundary).
export async function substitutePreview(
  template: { subject: string; body: string },
  variables: Parameters<typeof substituteSubjectAndBody>[1]
) {
  return substituteSubjectAndBody(template, variables);
}
