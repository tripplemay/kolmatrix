/**
 * BL-070-F009 · OutreachComposer dynamic boundary.
 *
 * Gates the 38.9KB composer bundle (forms, dialogs, server-action
 * wiring) behind next/dynamic({ssr:false}) so /reach initial JS
 * doesn't pull it on first paint. Skeleton matches the final
 * composer's resting height to prevent CLS while the chunk loads.
 */
"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import type { OutreachComposer as OutreachComposerType } from "./OutreachComposer";

type Props = ComponentProps<typeof OutreachComposerType>;

const Impl = dynamic(
  () =>
    import("./OutreachComposer").then((m) => ({
      default: m.OutreachComposer,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="glass-panel min-h-[640px] w-full animate-pulse rounded-2xl border border-on-surface/5"
        aria-hidden
        data-testid="outreach-composer-loading"
      />
    ),
  },
);

export function OutreachComposerLazy(props: Props) {
  return <Impl {...props} />;
}
