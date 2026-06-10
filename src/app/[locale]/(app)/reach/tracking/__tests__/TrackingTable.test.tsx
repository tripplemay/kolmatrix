/**
 * BL-110-F004 · TrackingTable reply-tracking footnote.
 *
 * The Replied column is all "—" in prod because reply tracking isn't
 * wired (inbound email = B4). When no visible row carries a repliedAt the
 * table renders an honest footnote instead of leaving the column header
 * implying replies are tracked; it disappears once a reply lands.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrackingTable, type TrackingRow } from "../TrackingTable";

const LABELS = {
  filterAll: "All",
  filterQueued: "Queued",
  filterSent: "Sent",
  filterDelivered: "Delivered",
  filterOpened: "Opened",
  filterClicked: "Clicked",
  filterBounced: "Bounced",
  filterComplained: "Complained",
  colSentAt: "Sent",
  colKol: "KOL",
  colSubject: "Subject",
  colStatus: "Status",
  colOpenedAt: "Opened",
  colRepliedAt: "Replied",
  colBounceReason: "Bounce reason",
  emptyState: "No emails match this filter yet.",
  nextPage: "Next",
  replyTrackingNote: "Reply tracking is pending inbound email integration (B4).",
};

function row(over: Partial<TrackingRow> = {}): TrackingRow {
  return {
    id: "log-1",
    sentAt: "2026-06-10T10:00:00.000Z",
    kolName: "Sarah Chen",
    kolHandle: "@sarah",
    platform: "youtube",
    subject: "Collab?",
    status: "delivered",
    openedAt: null,
    repliedAt: null,
    bounceReason: null,
    ...over,
  };
}

function renderTable(rows: TrackingRow[], replyTrackingPending: boolean) {
  return render(
    <TrackingTable
      rows={rows}
      statusFilter="all"
      nextCursorHref={null}
      labels={LABELS}
      basePath="/en/reach/tracking"
      replyTrackingPending={replyTrackingPending}
    />
  );
}

describe("TrackingTable reply footnote (BL-110-F004)", () => {
  it("shows the honest footnote when no row has a repliedAt", () => {
    renderTable([row({ repliedAt: null })], true);
    expect(screen.getByTestId("outreach-tracking-reply-note")).toHaveTextContent(
      LABELS.replyTrackingNote
    );
  });

  it("hides the footnote once a reply has landed", () => {
    renderTable([row({ repliedAt: "2026-06-10T12:00:00.000Z" })], false);
    expect(screen.queryByTestId("outreach-tracking-reply-note")).toBeNull();
  });

  it("does not render the footnote on the empty-filter state", () => {
    renderTable([], true);
    expect(screen.queryByTestId("outreach-tracking-reply-note")).toBeNull();
    expect(screen.getByTestId("outreach-tracking-empty")).toBeInTheDocument();
  });
});
