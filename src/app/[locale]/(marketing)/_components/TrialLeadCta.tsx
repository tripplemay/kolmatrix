"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { Dialog, DialogBackdrop, DialogPanel, DialogPortal, DialogTitle } from "@/components/ui/Dialog";

import { submitLead, type SubmitLeadState } from "../_actions/submit-lead";
import { type Attribution, readAttribution, sendLandingEvent } from "./landing-attribution";

const initial: SubmitLeadState = { ok: false };

interface Props {
  /** Button label (localized). */
  label: string;
  /** Analytics id + testid suffix (e.g. "hero", "footer"). */
  ctaId: string;
  /** Button class (visual variant supplied by caller). */
  className?: string;
}

/**
 * BL-115-F001 — primary conversion CTA: opens an in-page modal with the
 * 3-field trial form (name / company email / game studio). UTM + referrer +
 * landing path ride along as hidden fields (read on open). Submits via the
 * submitLead server action (useActionState); fires form_open / form_submit
 * funnel beacons. The button carries data-analytics-cta so LandingAnalytics'
 * delegated listener also records the click.
 */
export function TrialLeadCta({ label, ctaId, className }: Props) {
  const t = useTranslations("landing.trial");
  const [open, setOpen] = useState(false);
  const [attr, setAttr] = useState<Attribution>({});
  const [state, formAction, pending] = useActionState(submitLead, initial);

  const fieldError = (key: string) =>
    state.error === "invalid_input" ? state.fieldErrors?.[key] : undefined;

  return (
    <>
      <button
        type="button"
        data-analytics-cta={`trial-${ctaId}`}
        data-testid={`trial-cta-${ctaId}`}
        className={className}
        onClick={() => {
          setAttr(readAttribution());
          setOpen(true);
          sendLandingEvent("form_open", { cta: ctaId });
        }}
      >
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPanel size="sm" className="p-7" data-testid="trial-lead-modal">
            <DialogTitle className="text-xl">{t("title")}</DialogTitle>
            <p className="mt-2 text-sm text-on-surface-variant">{t("subtitle")}</p>

            {state.ok ? (
              <p
                data-testid="trial-lead-success"
                className="mt-8 rounded-md bg-cyan/10 px-4 py-6 text-center text-sm font-medium text-cyan-fixed"
              >
                {t("success")}
              </p>
            ) : (
              <form
                action={formAction}
                onSubmit={() => sendLandingEvent("form_submit", { cta: ctaId })}
                className="mt-6 flex flex-col gap-4"
                noValidate
              >
                {/* Ad-funnel attribution (hidden). */}
                <input type="hidden" name="utmSource" value={attr.utmSource ?? ""} />
                <input type="hidden" name="utmMedium" value={attr.utmMedium ?? ""} />
                <input type="hidden" name="utmCampaign" value={attr.utmCampaign ?? ""} />
                <input type="hidden" name="utmTerm" value={attr.utmTerm ?? ""} />
                <input type="hidden" name="utmContent" value={attr.utmContent ?? ""} />
                <input type="hidden" name="referrer" value={attr.referrer ?? ""} />
                <input type="hidden" name="landingPath" value={attr.landingPath ?? ""} />

                <label className="flex flex-col gap-1.5 text-left">
                  <span className="text-xs font-medium text-on-surface-variant">{t("name")}</span>
                  <input
                    name="name"
                    type="text"
                    required
                    maxLength={128}
                    autoComplete="name"
                    data-testid="trial-field-name"
                    className="rounded-md border border-outline-variant/40 bg-surface-low px-3 py-2 text-sm text-white placeholder:text-outline-variant focus:border-cyan focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-left">
                  <span className="text-xs font-medium text-on-surface-variant">{t("email")}</span>
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={320}
                    autoComplete="email"
                    data-testid="trial-field-email"
                    className="rounded-md border border-outline-variant/40 bg-surface-low px-3 py-2 text-sm text-white placeholder:text-outline-variant focus:border-cyan focus:outline-none"
                  />
                  {fieldError("email") && (
                    <span className="text-xs text-error">{t("errorEmail")}</span>
                  )}
                </label>
                <label className="flex flex-col gap-1.5 text-left">
                  <span className="text-xs font-medium text-on-surface-variant">{t("studio")}</span>
                  <input
                    name="studio"
                    type="text"
                    required
                    maxLength={160}
                    autoComplete="organization"
                    data-testid="trial-field-studio"
                    className="rounded-md border border-outline-variant/40 bg-surface-low px-3 py-2 text-sm text-white placeholder:text-outline-variant focus:border-cyan focus:outline-none"
                  />
                </label>

                {state.error === "invalid_input" && (
                  <p className="text-xs text-error">{t("errorInvalid")}</p>
                )}
                {state.error === "generic" && (
                  <p className="text-xs text-error">{t("errorGeneric")}</p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  data-testid="trial-submit"
                  className="landing-cta-primary mt-2 inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-bold disabled:opacity-60"
                >
                  {pending ? t("submitting") : t("submit")}
                </button>
              </form>
            )}
          </DialogPanel>
        </DialogPortal>
      </Dialog>
    </>
  );
}
