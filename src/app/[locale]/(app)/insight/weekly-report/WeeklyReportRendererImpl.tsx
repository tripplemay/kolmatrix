/**
 * BM2-F010 · `<WeeklyReportRenderer>` (Planner adjudication §13.5 #1
 * — `"use client"` to avoid GFM-table SSR/CSR hydration drift).
 *
 * Wraps `react-markdown` with `remark-gfm` so the AI's bullet/bold/
 * table output renders correctly. Tone-mapped via shared Tailwind
 * classes so the print stylesheet (`WeeklyReportPrintStyles`) can
 * drop colours uniformly.
 */
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  markdown: string;
  className?: string;
}

export default function WeeklyReportRendererImpl({ markdown, className }: Props) {
  return (
    <div
      data-testid="weekly-report-markdown"
      className={
        "prose prose-invert max-w-none prose-headings:text-white prose-h2:text-lg prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-wider prose-h2:text-cyan prose-strong:text-white prose-li:text-on-surface-variant prose-p:text-on-surface-variant prose-a:text-cyan " +
        (className ?? "")
      }
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
