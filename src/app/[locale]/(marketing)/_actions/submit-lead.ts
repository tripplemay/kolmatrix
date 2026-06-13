"use server";

import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events/log";

import { LeadSchema } from "./lead-schema";

export type SubmitLeadState = {
  ok: boolean;
  error?: "invalid_input" | "generic";
  fieldErrors?: Record<string, string>;
};

/**
 * BL-115-F001 — persist a landing-page trial request (anonymous, no tenant)
 * and emit a platform-level `landing.trial_request` event for the ad-funnel
 * analytics trail. Mirrors the request-access action shape (useActionState).
 */
export async function submitLead(
  _prev: SubmitLeadState,
  formData: FormData,
): Promise<SubmitLeadState> {
  const raw = Object.fromEntries(formData);

  const parsed = LeadSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "invalid_input", fieldErrors };
  }

  const data = parsed.data;

  try {
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        email: data.email,
        studio: data.studio,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        utmTerm: data.utmTerm ?? null,
        utmContent: data.utmContent ?? null,
        referrer: data.referrer ?? null,
        landingPath: data.landingPath ?? null,
      },
    });

    // Fire-and-forget conversion event (platform-level, tenantId null) so the
    // full ad funnel — cta_click → form_submit → trial_request — lands in
    // event_log for attribution. Never load-bearing for the submit.
    await logEvent({
      type: "landing.trial_request",
      resourceId: lead.id,
      payload: {
        studio: data.studio,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
      },
    });

    return { ok: true };
  } catch (err) {
    console.error("[submit-lead] failed:", err);
    return { ok: false, error: "generic" };
  }
}
