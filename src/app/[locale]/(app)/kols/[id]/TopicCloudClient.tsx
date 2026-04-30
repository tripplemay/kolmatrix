"use client";

/**
 * B5-F006 · Client wrapper that lazy-loads the @visx/wordcloud canvas.
 *
 * `dynamic(..., { ssr: false })` is only honoured inside a client
 * component (Next 15+ disallows it in server components), so this
 * thin shim sits between the server `TopicCloud` panel and the
 * actual SVG renderer. The visx + d3-cloud chunk lands only on the
 * KOL detail page bundle on first hover/render.
 */
import dynamic from "next/dynamic";

import type { TopicKeyword } from "@/lib/kol-detail/topic-cloud";

const TopicCloudCanvas = dynamic(() => import("./TopicCloudCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[160px] w-full animate-pulse rounded-lg bg-white/[0.02]"
      aria-hidden
      data-testid="kol-topic-cloud-loading"
    />
  ),
});

interface Props {
  keywords: TopicKeyword[];
}

export function TopicCloudClient({ keywords }: Props) {
  return <TopicCloudCanvas keywords={keywords} />;
}
