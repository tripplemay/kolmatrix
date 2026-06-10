/**
 * BL-110-F004 · RecentRepliesCard honest empty state.
 *
 * runRecentReplies returns all-time repliedAt rows, so an empty list means
 * no reply data exists at all (reply tracking isn't wired — inbound email
 * = B4). The card then shows an honest "待上线(B4)" message rather than
 * "No replies yet" (which falsely implies replies are tracked at zero).
 * When rows exist it renders the list normally.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getFormatter: async () => ({ dateTime: () => "Jun 10, 2026, 10:00 AM" }),
}));

import type { RecentReplyRow } from "@/lib/email/analytics";

import { RecentRepliesCard } from "../RecentRepliesCard";

describe("RecentRepliesCard (BL-110-F004)", () => {
  it("renders the honest pending message when there is no reply data", async () => {
    render(await RecentRepliesCard({ rows: [] }));
    const pending = screen.getByTestId("outreach-recent-replies-pending");
    expect(pending).toHaveTextContent("pending");
    expect(screen.queryByTestId("outreach-recent-reply-row")).toBeNull();
  });

  it("renders reply rows when reply data exists (dev seed / post-B4)", async () => {
    const rows: RecentReplyRow[] = [
      {
        kolId: "kol-1",
        displayName: "Sarah Chen",
        avatarUrl: null,
        repliedAt: "2026-06-10T10:00:00.000Z",
        subject: "Collab?",
      },
    ];
    render(await RecentRepliesCard({ rows }));
    expect(screen.getByTestId("outreach-recent-reply-row")).toBeInTheDocument();
    expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
    expect(screen.queryByTestId("outreach-recent-replies-pending")).toBeNull();
  });
});
