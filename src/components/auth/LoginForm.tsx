"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/[locale]/login/actions";

const initial: LoginState = {};

type LoginErrorKey = "missing_fields" | "invalid_credentials" | "generic" | "rate_limited";

const ERROR_TO_I18N: Record<LoginErrorKey, string> = {
  missing_fields: "errorMissingFields",
  invalid_credentials: "errorInvalidCredentials",
  generic: "errorGeneric",
  rate_limited: "errorRateLimited",
};

export function LoginForm() {
  const t = useTranslations("auth.login");
  const [state, formAction, pending] = useActionState(loginAction, initial);

  const errorKey = (state.error ?? null) as LoginErrorKey | null;
  const errorMessage =
    errorKey && ERROR_TO_I18N[errorKey]
      ? t(ERROR_TO_I18N[errorKey], {
          retryAfter: state.retryAfter ?? 0,
        })
      : null;

  return (
    <div className="flex w-full max-w-[400px] flex-col space-y-10">
      <div className="space-y-2">
        <h2 className="text-[26px] font-bold tracking-tight text-white">{t("welcomeBack")}</h2>
        <p className="text-sm font-medium text-on-surface-variant">{t("welcomeSubtitle")}</p>
      </div>

      <form action={formAction} className="flex flex-col space-y-8" noValidate>
        <div className="space-y-6">
          {/* Email */}
          <div className="group">
            <label
              htmlFor="login-email"
              className="mb-2 block text-[11px] font-bold tracking-widest uppercase text-on-surface-variant/60 transition-colors group-focus-within:text-cyan"
            >
              {t("emailLabel")}
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder={t("emailPlaceholder")}
              className="w-full rounded-none border-0 border-b border-outline-variant bg-transparent px-0 py-3 text-sm text-white placeholder:text-on-surface-variant/30 focus:border-cyan focus:outline-none focus:ring-0"
              style={{ transition: "border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
            />
          </div>

          {/* Password */}
          <div className="group">
            <label
              htmlFor="login-password"
              className="mb-2 block text-[11px] font-bold tracking-widest uppercase text-on-surface-variant/60 transition-colors group-focus-within:text-cyan"
            >
              {t("passwordLabel")}
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              className="w-full rounded-none border-0 border-b border-outline-variant bg-transparent px-0 py-3 text-sm text-white placeholder:text-on-surface-variant/30 focus:border-cyan focus:outline-none focus:ring-0"
              style={{ transition: "border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
            />
          </div>
        </div>

        {/* Utilities row */}
        <div className="flex items-center justify-between text-xs font-medium">
          <label className="group flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="rememberDevice"
              className="h-4 w-4 rounded border-outline-variant bg-surface-highest/40 text-cyan focus:ring-cyan/20 focus:ring-offset-0"
            />
            <span className="text-on-surface-variant transition-colors group-hover:text-on-surface">
              {t("rememberDevice")}
            </span>
          </label>
          <Link
            href="#"
            className="text-cyan-fixed transition-colors hover:text-cyan"
            aria-label={t("forgotPassword")}
          >
            {t("forgotPassword")}
          </Link>
        </div>

        {errorMessage ? (
          <p role="alert" className="-mt-4 text-sm text-error">
            {errorMessage}
          </p>
        ) : null}

        {/* Primary CTA */}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-cyan py-4 text-sm font-bold tracking-tight text-on-primary transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ boxShadow: "0 0 24px rgba(0, 229, 255, 0.25)" }}
        >
          {pending ? t("submitting") : t("signInButton")}
        </button>
      </form>

      {/* Divider + Google (disabled) */}
      <div className="space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="flex-grow border-t border-outline-variant/30" />
          <span className="mx-4 flex-shrink text-[10px] font-bold tracking-widest text-on-surface-variant/40">
            {t("orDivider")}
          </span>
          <div className="flex-grow border-t border-outline-variant/30" />
        </div>

        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t("googleDisabledTooltip")}
          className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-outline-variant/20 bg-surface-highest/30 py-3.5 font-semibold text-white opacity-60"
        >
          <svg
            className="h-5 w-5 grayscale"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {t("continueWithGoogle")}
        </button>
      </div>

      {/* Footer — Request access */}
      <p className="text-center text-xs font-medium text-on-surface-variant">
        {t("newToKolmatrix")}{" "}
        <Link
          href="/request-access"
          className="ml-1 text-cyan-fixed transition-colors hover:text-cyan"
        >
          {t("requestAccessLink")}
        </Link>
      </p>
    </div>
  );
}
