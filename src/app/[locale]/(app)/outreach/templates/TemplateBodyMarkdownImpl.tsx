/**
 * BIx-F005-E · Implementation of the markdown preview pane used by
 * TemplateWorkspaceClient. Lives in its own file so the parent can
 * gate the react-markdown + remark-gfm bundle (~50KB gzipped) behind
 * next/dynamic.
 */
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  body: string;
}

export default function TemplateBodyMarkdownImpl({ body }: Props) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>;
}
