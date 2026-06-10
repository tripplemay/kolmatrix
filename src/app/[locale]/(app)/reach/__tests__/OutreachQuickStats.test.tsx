/**
 * BL-110-F004 · OutreachQuickStats reply-rate honest empty.
 *
 * Reply tracking isn't wired (inbound email = B4), so replyRatePercent is
 * a fabricated 0.0% in prod. When stats.replyTrackingPending is true the
 * Reply rate cell shows "—" + a "待上线(B4)" hint instead; once real reply
 * data exists it shows the computed percentage with the normal window hint.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Identity translator: t(key) → key, enough to assert which key drives
// the hint (replyPending vs windowHint).
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import type { EmailQuickStats } from "@/lib/email/analytics";

import { OutreachQuickStats } from "../OutreachQuickStats";

function stats(over: Partial<EmailQuickStats> = {}): EmailQuickStats {
  return {
    sentToday: 12,
    openRatePercent: 40,
    replyRatePercent: 0,
    bounceRatePercent: 1.2,
    deliverabilityPercent: 98.8,
    totalSent30d: 100,
    replyTrackingPending: true,
    ...over,
  };
}

describe("OutreachQuickStats reply rate (BL-110-F004)", () => {
  it("shows an em dash + pending hint when reply tracking is pending", async () => {
    render(await OutreachQuickStats({ stats: stats({ replyTrackingPending: true }) }));
    expect(screen.getByTestId("outreach-kpi-reply-rate")).toHaveTextContent("—");
    expect(screen.getByTestId("outreach-kpi-reply-rate")).not.toHaveTextContent("0.0%");
    expect(screen.getByTestId("outreach-kpi-reply-rate-hint")).toHaveTextContent("replyPending");
  });

  it("shows the computed percentage + window hint once reply data exists", async () => {
    render(
      await OutreachQuickStats({
        stats: stats({ replyTrackingPending: false, replyRatePercent: 12.5 }),
      })
    );
    expect(screen.getByTestId("outreach-kpi-reply-rate")).toHaveTextContent("12.5%");
    expect(screen.queryByTestId("outreach-kpi-reply-rate-hint")).toBeNull();
  });
});
