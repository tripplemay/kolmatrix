/**
 * BIx-F005-E · Wrapper that gates the react-markdown bundle behind
 * next/dynamic. Pre-loaded skeleton matches the surrounding prose
 * layout so the swap is invisible to the user.
 */
"use client";

import dynamic from "next/dynamic";

interface Props {
  body: string;
}

const Impl = dynamic(() => import("./TemplateBodyMarkdownImpl"), {
  ssr: false,
  loading: () => (
    <div
      className="h-24 w-full animate-pulse rounded bg-gray-100"
      aria-hidden
      data-testid="template-body-markdown-loading"
    />
  ),
});

export function TemplateBodyMarkdown(props: Props) {
  return <Impl {...props} />;
}
