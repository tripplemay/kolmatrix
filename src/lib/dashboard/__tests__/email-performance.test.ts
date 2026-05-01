import { describe, expect, it, vi } from "vitest";

import { fetchEmailPerformance } from "../email-performance";

type Row = {
  sentAt: Date | null;
  status: string;
  openedAt: Date | null;
  repliedAt: Date | null;
};

function buildTx(rows: Row[]) {
  return {
    emailLog: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
  } as unknown as Parameters<typeof fetchEmailPerformance>[0];
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("fetchEmailPerformance", () => {
  it("always returns 14 ordered buckets, even on an empty result", async () => {
    const out = await fetchEmailPerformance(buildTx([]));
    expect(out).toHaveLength(14);
    for (const p of out) {
      expect(p.sent).toBe(0);
      expect(p.opened).toBe(0);
      expect(p.replied).toBe(0);
      expect(typeof p.date).toBe("string");
    }
  });

  it("counts sent / opened / replied into today's bucket", async () => {
    const now = new Date();
    const rows: Row[] = [
      { sentAt: now, status: "sent", openedAt: null, repliedAt: null },
      { sentAt: now, status: "opened", openedAt: now, repliedAt: null },
      { sentAt: now, status: "replied", openedAt: now, repliedAt: now },
    ];
    const out = await fetchEmailPerformance(buildTx(rows));
    const today = out[out.length - 1];
    // sent = non-bounced/non-queued ⇒ all 3
    expect(today.sent).toBe(3);
    // opened = openedAt set ⇒ 2 of them
    expect(today.opened).toBe(2);
    // replied = repliedAt set ⇒ 1
    expect(today.replied).toBe(1);
  });

  it("excludes bounced emails from the sent count but still buckets the row", async () => {
    const now = new Date();
    const rows: Row[] = [
      { sentAt: now, status: "bounced", openedAt: null, repliedAt: null },
      { sentAt: now, status: "queued", openedAt: null, repliedAt: null },
      { sentAt: now, status: "sent", openedAt: null, repliedAt: null },
    ];
    const out = await fetchEmailPerformance(buildTx(rows));
    const today = out[out.length - 1];
    expect(today.sent).toBe(1);
  });

  it("ignores rows with sentAt outside the 14-day window", async () => {
    const inside = new Date(Date.now() - 3 * DAY_MS);
    const outside = new Date(Date.now() - 30 * DAY_MS);
    const rows: Row[] = [
      { sentAt: inside, status: "sent", openedAt: null, repliedAt: null },
      { sentAt: outside, status: "sent", openedAt: null, repliedAt: null },
    ];
    // The DB query already filters by `sentAt >= cutoff`; we mirror that
    // by only feeding `inside` to the in-memory bucket loop. Pass both
    // anyway and trust the date-key lookup to drop outsiders.
    const out = await fetchEmailPerformance(buildTx(rows));
    const total = out.reduce((s, p) => s + p.sent, 0);
    expect(total).toBe(1);
  });

  it("rows with null sentAt are skipped silently", async () => {
    const rows: Row[] = [{ sentAt: null, status: "queued", openedAt: null, repliedAt: null }];
    const out = await fetchEmailPerformance(buildTx(rows));
    const total = out.reduce((s, p) => s + p.sent + p.opened + p.replied, 0);
    expect(total).toBe(0);
  });
});
