/**
 * BM2-F010 · Empty state — shown when no WeeklyReport row exists for
 * the current tenant. Single Generate CTA per Planner adjudication
 * §13 row #5 ("显式按钮，未生成时显空态").
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import type { WeeklyReportRange } from "@/lib/weekly-report/range";

import { generateWeeklyReportAction } from "./actions";

interface Props {
  weekStartIso: string;
  locale: "en" | "zh";
  range: WeeklyReportRange;
  title: string;
  body: string;
  generateLabel: string;
  loadingLabel: string;
  errorLabel: string;
}

export function WeeklyReportEmptyState({
  weekStartIso,
  locale,
  range,
  title,
  body,
  generateLabel,
  loadingLabel,
  errorLabel,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const res = await generateWeeklyReportAction(weekStartIso, locale, range);
      if (!res.ok) {
        console.error("[weekly-report] generate failed:", res.error);
        alert(errorLabel);
        return;
      }
      router.refresh();
    });
  };

  return (
    <article
      data-testid="weekly-report-empty"
      className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border border-white/5 bg-surface-low/60 p-12 text-center"
    >
      <span
        aria-hidden
        className="material-symbols-outlined text-5xl text-cyan/60"
      >
        article
      </span>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="text-sm text-on-surface-variant">{body}</p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        data-testid="weekly-report-empty-generate"
        className="rounded-xl bg-gradient-to-br from-[#00daf3] to-[#c3f5ff] px-6 py-3 text-sm font-bold text-on-primary disabled:cursor-progress disabled:opacity-60"
      >
        {isPending ? loadingLabel : generateLabel}
      </button>
    </article>
  );
}
