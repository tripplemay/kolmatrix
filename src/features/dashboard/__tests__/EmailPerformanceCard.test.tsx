/**
 * BL-110-F004 · EmailPerformanceCard reply-line footnote.
 *
 * The Replied line is flat at 0 when reply tracking isn't wired (inbound
 * email = B4). The card keeps the line (B4 revives it) but adds an honest
 * footnote — driven by the `replyTrackingPending` PROP (all-time reply
 * existence), NOT by the 14-day chart rows.
 *
 * fix-round 1: the original chart-derived heuristic (`data.every(replied
 * === 0)`) false-flagged tenants whose replies predated the 14-day window
 * (staging blocker: /reach showed reply KPI 18.5% while /insight showed
 * the B4 pending note). The regression case below locks that out.
 */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import type { EmailPerfPoint } from "@/lib/dashboard/email-performance";

import { EmailPerformanceCard } from "../EmailPerformanceCard";

const messages = {
  dashboard: {
    emailPerformance: "Email Performance",
    emailPerformanceEmpty: "Send your first batch to see trends.",
    emailPerformanceReplyNote: "Reply data is pending inbound email integration (B4).",
    emailPerformanceChart: { sent: "Sent", opened: "Opened", replied: "Replied" },
  },
};

function withIntl(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

function points(make: (i: number) => Partial<EmailPerfPoint>): EmailPerfPoint[] {
  return Array.from({ length: 14 }, (_, i) => ({
    date: `Jun ${i + 1}`,
    sent: 0,
    opened: 0,
    replied: 0,
    ...make(i),
  }));
}

describe("EmailPerformanceCard reply note (BL-110-F004)", () => {
  it("shows the honest reply note when there's activity and no reply data exists", () => {
    render(
      withIntl(
        <EmailPerformanceCard
          data={points(() => ({ sent: 5, opened: 2 }))}
          replyTrackingPending
        />
      )
    );
    expect(screen.getByTestId("dashboard-email-perf-reply-note")).toHaveTextContent(
      messages.dashboard.emailPerformanceReplyNote
    );
  });

  it("hides the reply note when reply data exists (prop false)", () => {
    render(
      withIntl(
        <EmailPerformanceCard
          data={points(() => ({ sent: 5, opened: 2, replied: 1 }))}
          replyTrackingPending={false}
        />
      )
    );
    expect(screen.queryByTestId("dashboard-email-perf-reply-note")).toBeNull();
  });

  // fix-round-1 BLOCKER regression: the 14-day chart is flat-0 on replies
  // (the old heuristic would flag "pending"), but the tenant DOES have
  // historical reply data (prop false) → note must NOT render.
  it("hides the note when the 14-day chart has no replies but historical reply data exists", () => {
    render(
      withIntl(
        <EmailPerformanceCard
          data={points(() => ({ sent: 8, opened: 3, replied: 0 }))}
          replyTrackingPending={false}
        />
      )
    );
    expect(screen.queryByTestId("dashboard-email-perf-reply-note")).toBeNull();
  });

  it("renders the fully-empty state (no chart, no reply note) when there's no activity at all", () => {
    render(withIntl(<EmailPerformanceCard data={points(() => ({}))} replyTrackingPending />));
    expect(screen.queryByTestId("dashboard-email-perf-reply-note")).toBeNull();
    expect(screen.getByText(messages.dashboard.emailPerformanceEmpty)).toBeInTheDocument();
  });
});
