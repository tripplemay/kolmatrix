"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cloneElement, useActionState, useEffect } from "react";

import {
  submitAccessRequest,
  type SubmitAccessRequestState,
} from "@/app/[locale]/request-access/actions";
import {
  CAMPAIGNS_OPTIONS,
  ROLE_OPTIONS,
} from "@/app/[locale]/request-access/form-options";

const initial: SubmitAccessRequestState = { ok: false };

const ROLE_I18N_KEYS: Record<(typeof ROLE_OPTIONS)[number], string> = {
  "marketing-manager": "roleOptionMarketingManager",
  "influencer-relations": "roleOptionInfluencerRelations",
  "growth-lead": "roleOptionGrowthLead",
  founder: "roleOptionFounder",
  "agency-pm": "roleOptionAgencyPm",
  other: "roleOptionOther",
};

const CAMPAIGNS_I18N_KEYS: Record<(typeof CAMPAIGNS_OPTIONS)[number], string> = {
  "0-5": "campaignsOption05",
  "6-20": "campaignsOption620",
  "21-50": "campaignsOption2150",
  "50+": "campaignsOption50plus",
};

interface Props {
  locale: string;
}

const UNDERLINE_INPUT =
  "w-full rounded-none border-0 border-b border-outline-variant bg-transparent px-0 py-2 text-sm text-white placeholder:text-outline-variant focus:border-cyan focus:outline-none focus:ring-0";

export function RequestAccessForm({ locale }: Props) {
  const t = useTranslations("auth.requestAccess");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitAccessRequest, initial);
  const searchParams = useSearchParams();
  const wantsDemoDefault = searchParams.get("demo") === "1";

  useEffect(() => {
    if (state.ok) {
      router.push(`/${locale}/request-access/success`);
    }
  }, [state.ok, router, locale]);

  const globalError =
    state.error === "tos_required"
      ? t("errorTosRequired")
      : state.error === "invalid_input"
        ? t("errorInvalidInput")
        : state.error === "generic"
          ? t("errorGeneric")
          : null;

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-10 text-left">
        <h3 className="text-3xl font-bold tracking-tight text-white">{t("formTitle")}</h3>
        <p className="mt-2 text-sm text-on-surface-variant">{t("formSubtitle")}</p>
      </div>

      <form action={formAction} className="space-y-6" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <FieldWrapper label={t("firstNameLabel")}>
            <input
              name="firstName"
              type="text"
              required
              maxLength={64}
              placeholder={t("firstNamePlaceholder")}
              className={UNDERLINE_INPUT}
              aria-invalid={Boolean(state.fieldErrors?.firstName)}
            />
          </FieldWrapper>
          <FieldWrapper label={t("lastNameLabel")}>
            <input
              name="lastName"
              type="text"
              required
              maxLength={64}
              placeholder={t("lastNamePlaceholder")}
              className={UNDERLINE_INPUT}
              aria-invalid={Boolean(state.fieldErrors?.lastName)}
            />
          </FieldWrapper>
        </div>

        <FieldWrapper label={t("emailLabel")} hint={t("emailHint")}>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={320}
            placeholder={t("emailPlaceholder")}
            className={UNDERLINE_INPUT}
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
        </FieldWrapper>

        <FieldWrapper label={t("companyLabel")}>
          <input
            name="company"
            type="text"
            required
            maxLength={128}
            placeholder={t("companyPlaceholder")}
            className={UNDERLINE_INPUT}
            aria-invalid={Boolean(state.fieldErrors?.company)}
          />
        </FieldWrapper>

        <div className="grid grid-cols-2 gap-4">
          <FieldWrapper label={t("roleLabel")}>
            <select
              name="role"
              required
              defaultValue=""
              className={`${UNDERLINE_INPUT} appearance-none`}
            >
              <option value="" disabled hidden>
                —
              </option>
              {ROLE_OPTIONS.map((value) => (
                <option key={value} value={value} className="bg-surface-high">
                  {t(ROLE_I18N_KEYS[value])}
                </option>
              ))}
            </select>
          </FieldWrapper>
          <FieldWrapper label={t("campaignsLabel")}>
            <select
              name="campaignsPerQuarter"
              required
              defaultValue=""
              className={`${UNDERLINE_INPUT} appearance-none`}
            >
              <option value="" disabled hidden>
                —
              </option>
              {CAMPAIGNS_OPTIONS.map((value) => (
                <option key={value} value={value} className="bg-surface-high">
                  {t(CAMPAIGNS_I18N_KEYS[value])}
                </option>
              ))}
            </select>
          </FieldWrapper>
        </div>

        <FieldWrapper label={t("gamesLabel")}>
          <textarea
            name="games"
            rows={2}
            maxLength={2000}
            placeholder={t("gamesPlaceholder")}
            className={`${UNDERLINE_INPUT} resize-none`}
          />
        </FieldWrapper>

        <label className="flex items-start gap-2 text-sm text-on-surface-variant">
          <input
            type="checkbox"
            name="wantsDemo"
            defaultChecked={wantsDemoDefault}
            className="mt-1 h-4 w-4 accent-cyan"
            data-testid="request-access-wants-demo"
          />
          <span>{t("wantsDemoLabel")}</span>
        </label>

        <label className="flex items-start gap-3 pt-2">
          <span className="flex h-5 items-center">
            <input
              type="checkbox"
              name="tosAccepted"
              value="on"
              className="h-4 w-4 rounded border-outline-variant bg-surface-highest text-cyan focus:ring-cyan/20"
              aria-invalid={state.error === "tos_required"}
            />
          </span>
          <span className="text-xs leading-tight text-on-surface-variant">
            {t.rich("tosAccept", {
              tos: (chunks) => (
                <Link
                  href="#"
                  className="text-cyan hover:underline"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="#"
                  className="text-cyan hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>

        {globalError ? (
          <p role="alert" className="text-sm text-error">
            {globalError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-cyan py-4 text-sm font-bold tracking-widest uppercase text-navy-base transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ boxShadow: "0 0 30px rgba(0, 229, 255, 0.25)" }}
        >
          {pending ? t("submitting") : t("submitButton")}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-xs text-on-surface-variant">
          {t("alreadyHaveAccess")}{" "}
          <Link
            href={`/${locale}/login`}
            className="font-semibold text-cyan hover:underline"
          >
            {t("signInLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * FieldWrapper renders a `<label>` above the child control and wires
 * `htmlFor` → child `id` so the control has an accessible name
 * (Testing Library's `getByRole("combobox", { name: /Role/ })` relies
 * on this association, as do screen readers).
 *
 * The child is expected to own its `name` attribute; we derive the id
 * from `name`, but honour an explicit `id` if present.
 */
function FieldWrapper({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactElement<{ id?: string; name?: string }>;
}) {
  const baseName = children.props.id ?? children.props.name;
  const id = baseName ? `request-access-${baseName}` : undefined;
  const child = id ? cloneElement(children, { id }) : children;
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="text-[11px] font-bold tracking-wider text-cyan-fixed uppercase"
      >
        {label}
      </label>
      {child}
      {hint ? <p className="mt-1 text-[10px] text-outline">{hint}</p> : null}
    </div>
  );
}
