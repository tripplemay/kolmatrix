/**
 * BL-110-F004 · EmailPerformanceCard reply-line footnote.
 *
 * The Replied line is flat at 0 in prod because reply tracking isn't
 * wired (inbound email = B4). The card keeps the line (B4 revives it) but
 * adds an honest footnote when every bucket's replied === 0 so a flat-0
 * line isn't read as a measured "0 replies every day".
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
  it("shows the honest reply note when there is activity but zero replies", () => {
    render(withIntl(<EmailPerformanceCard data={points(() => ({ sent: 5, opened: 2 }))} />));
    expect(screen.getByTestId("dashboard-email-perf-reply-note")).toHaveTextContent(
      messages.dashboard.emailPerformanceReplyNote
    );
  });

  it("hides the reply note once replies exist", () => {
    render(
      withIntl(<EmailPerformanceCard data={points(() => ({ sent: 5, opened: 2, replied: 1 }))} />)
    );
    expect(screen.queryByTestId("dashboard-email-perf-reply-note")).toBeNull();
  });

  it("renders the fully-empty state (no chart, no reply note) when there's no activity at all", () => {
    render(withIntl(<EmailPerformanceCard data={points(() => ({}))} />));
    expect(screen.queryByTestId("dashboard-email-perf-reply-note")).toBeNull();
    expect(screen.getByText(messages.dashboard.emailPerformanceEmpty)).toBeInTheDocument();
  });
});
