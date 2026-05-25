/**
 * BL-070-F009 · MatchRefineBar dynamic boundary.
 *
 * Only mounts when ?campaignId= resolves; gating the natural-language
 * refine bundle (zod schema + localStorage cache + server-action
 * wiring) behind next/dynamic({ssr:false}) so the no-campaign /match
 * path doesn't pay for it.
 */
"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import type { MatchRefineBar as MatchRefineBarType } from "./MatchRefineBar";

type Props = ComponentProps<typeof MatchRefineBarType>;

const Impl = dynamic(
  () =>
    import("./MatchRefineBar").then((m) => ({ default: m.MatchRefineBar })),
  {
    ssr: false,
    loading: () => (
      <div
        className="glass-panel min-h-[88px] w-full animate-pulse rounded-2xl border border-on-surface/5"
        aria-hidden
        data-testid="match-refine-bar-loading"
      />
    ),
  },
);

export function MatchRefineBarLazy(props: Props) {
  return <Impl {...props} />;
}
