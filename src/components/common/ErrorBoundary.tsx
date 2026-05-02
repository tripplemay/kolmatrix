"use client";

/**
 * BIx-mvp-polish-pass F003 — Shared error.tsx body.
 *
 * Each route under `(app)/` re-exports this component from its own
 * `error.tsx` so unhandled server-component / suspense errors render
 * a friendly page instead of Next's stark default. The component is
 * intentionally minimal (no DB / no aigcgateway / no auth) — error
 * boundaries must NOT call code that can itself fail, otherwise the
 * boundary itself crashes and the user sees the framework error UI.
 *
 * Per Next 15 conventions, this is a Client Component (`error.tsx`
 * MUST be a CC) and accepts `(error, reset)` props.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { GlassPanel } from "./GlassPanel";

export interface ErrorBoundaryProps {
  /**
   * Forwarded from the route-level error.tsx wrapper. The `digest`
   * field is what Next-prod passes through; the message is dev-only.
   */
  error: Error & { digest?: string };
  /** Re-runs the segment that threw. Wired to the "Try again" CTA. */
  reset: () => void;
  /**
   * Where this boundary mounted. Helps the user recognise which
   * surface broke + lets ops grep server logs by route. Optional —
   * routes that want a generic message can omit it.
   */
  scope?: string;
}

export function ErrorBoundary({ error, reset, scope }: ErrorBoundaryProps) {
  const t = useTranslations("common.error");

  useEffect(() => {
    // Surface the digest to the browser console so ops can correlate
    // a customer's screenshot with the server log line. The digest is
    // a hash Next emits in prod; the raw message + stack are dev-only.
    console.error("[ErrorBoundary]", scope ?? "unknown", {
      digest: error.digest,
      message: error.message,
    });
  }, [error, scope]);

  return (
    <div
      className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-16"
      data-testid="route-error-boundary"
      data-scope={scope}
    >
      <GlassPanel padding="lg" rounded="2xl" tone="neutral" className="w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/10">
          <span className="material-symbols-outlined text-[32px] text-rose-300" aria-hidden>
            error
          </span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">{t("title")}</h1>
        <p className="text-on-surface-variant mb-6 text-sm">{t("body")}</p>
        {error.digest ? (
          <p className="text-on-surface-variant/60 mb-6 font-mono text-[10px]">
            ref · {error.digest}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            data-testid="route-error-retry"
            className="border-cyan/30 bg-cyan/15 text-cyan hover:border-cyan hover:bg-cyan/20 rounded-xl border px-5 py-2.5 text-xs font-bold transition-colors"
          >
            {t("retry")}
          </button>
          <Link
            href="/"
            data-testid="route-error-home"
            className="text-on-surface-variant rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold transition-colors hover:text-white"
          >
            {t("backHome")}
          </Link>
        </div>
      </GlassPanel>
    </div>
  );
}
