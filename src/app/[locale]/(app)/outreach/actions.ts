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
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";
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
      tx.emailTemplate.findUnique({
        where: { id: parsed.data.templateId },
        select: { subject: true, body: true, locale: true },
      }),
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

  revalidatePath("/[locale]/outreach", "page");
  return { ok: true };
}

// --- Batch send ------------------------------------------------------

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
    .max(50),
});

export type SendBatchInput = z.infer<typeof sendBatchSchema>;

export async function sendBatchAction(
  input: SendBatchInput
): Promise<ComposerActionState<BatchSendResult>> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };

  const parsed = sendBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
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

  let result: BatchSendResult;
  try {
    result = await batchSendOutreach(
      session.tenantId,
      session.userId,
      parsed.data.campaignId,
      items,
      { skipSleep: false }
    );
  } catch (err) {
    console.error("[sendBatchAction] failed:", err);
    return { ok: false, error: "db_error" };
  }

  revalidatePath("/[locale]/outreach", "page");
  revalidatePath(`/[locale]/campaigns/${parsed.data.campaignId}`, "page");
  return { ok: true, data: result };
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

  void revalidatePath("/[locale]/outreach", "page");
  void revalidatePath("/[locale]/outreach/templates", "page");
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

  void revalidatePath("/[locale]/outreach", "page");
  void revalidatePath("/[locale]/outreach/templates", "page");
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

  void revalidatePath("/[locale]/outreach", "page");
  void revalidatePath("/[locale]/outreach/templates", "page");
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
