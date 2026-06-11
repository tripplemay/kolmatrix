/**
 * BM2-F006 · /outreach server-side batch send integration spec.
 *
 * Covers the happy path + the three main failure modes the UI relies
 * on distinguishing:
 *   - sent   (RESEND_API_KEY present; SDK mock returns success)
 *   - mock_sent (RESEND_API_KEY absent → structured log fallback)
 *   - failed (SDK returns an error)
 *
 * Also validates:
 *   - KolCampaign.status auto-advances from pending → contacted
 *   - audit_log writes one campaign.kol.status_changed per advance
 *   - event_log writes one email.sent per attempt
 *   - Downstream analytics helpers see the fresh rows
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

// ---- Module stubs ---------------------------------------------------

const sendMock = vi.fn();
vi.mock("resend", () => {
  class Resend {
    emails = { send: sendMock };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_apiKey: string) {}
  }
  return { Resend };
});

type Batch = typeof import("@/lib/email/batch-send");
type Analytics = typeof import("@/lib/email/analytics");

let batch: Batch;
let analytics: Analytics;

const TENANT = "aaaaaaaa-0000-4000-8000-000000000001";
const OWNER = "bbbbbbbb-0000-4000-8000-000000000002";

beforeAll(async () => {
  await setupTestDb();
  batch = await import("@/lib/email/batch-send");
  analytics = await import("@/lib/email/analytics");
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "audit_log"`);
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "event_log"`);
  sendMock.mockReset();
  delete process.env.RESEND_API_KEY;
});

async function seedWorld() {
  const admin = getAdminPrisma();
  await admin.tenant.upsert({
    where: { id: TENANT },
    create: {
      id: TENANT,
      name: "Outreach tenant",
      slug: `outreach-${Date.now()}`,
    },
    update: {},
  });
  await admin.user.upsert({
    where: { id: OWNER },
    create: {
      id: OWNER,
      tenantId: TENANT,
      email: "owner@outreach.test",
      name: "Owner",
    },
    update: {},
  });
  const product = await admin.product.create({
    data: {
      tenantId: TENANT,
      name: "Nebula",
      category: "MOBA",
      targetAudience: "Cross-platform MOBA enthusiasts aged 18-30",
      uniqueSellingPoints: "Cross-platform",
    },
  });
  const campaign = await admin.campaign.create({
    data: {
      tenantId: TENANT,
      name: "Launch",
      ownerUserId: OWNER,
      productId: product.id,
      status: "draft",
      spendTotal: "0",
    },
  });
  const kolIds: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const k = await admin.kol.create({
      data: {
        tenantId: TENANT,
        platform: "youtube",
        handle: `kol_${i}`,
        displayName: `Kol ${i}`,
        email: `kol${i}@example.test`,
      },
    });
    await admin.kolCampaign.create({
      data: {
        tenantId: TENANT,
        kolId: k.id,
        campaignId: campaign.id,
        status: "pending",
      },
    });
    kolIds.push(k.id);
  }
  return { campaignId: campaign.id, kolIds };
}

describe("batchSendOutreach — mock fallback (no RESEND_API_KEY)", () => {
  it("writes EmailLog rows as mock_sent and advances KolCampaign.status", async () => {
    const { campaignId, kolIds } = await seedWorld();
    const items = kolIds.map((kolId, i) => ({
      kolCampaignId: "",
      kolId,
      toAddress: `kol${i}@example.test`,
      subject: `Hello ${i}`,
      bodyText: "Hi there",
      templateId: null,
      aiCustomized: false,
    }));

    const result = await batch.batchSendOutreach(
      TENANT,
      OWNER,
      campaignId,
      items,
      null,
      { skipSleep: true }
    );

    expect(result.mocked).toBe(3);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.items).toHaveLength(3);
    for (const item of result.items) {
      expect(item.status).toBe("mock_sent");
    }

    const admin = getAdminPrisma();
    const logs = await admin.emailLog.findMany({
      where: { tenantId: TENANT },
    });
    expect(logs).toHaveLength(3);
    expect(logs.every((l) => l.status === "mock_sent")).toBe(true);

    // Every KolCampaign should now be "contacted".
    const links = await admin.kolCampaign.findMany({
      where: { tenantId: TENANT, campaignId },
    });
    expect(links.every((l) => l.status === "contacted")).toBe(true);

    // One audit_log row per status change.
    const audits = await admin.auditLog.findMany({
      where: { action: "campaign.kol.status_changed" },
    });
    expect(audits).toHaveLength(3);

    // Give the fire-and-forget event_log inserts a moment, then poll.
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const events = await admin.eventLog.findMany({
        where: { type: "email.sent" },
      });
      if (events.length >= 3) {
        expect(events).toHaveLength(3);
        return;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("timed out waiting for event_log entries");
  });
});

describe("batchSendOutreach — real provider path (mocked SDK)", () => {
  it("marks EmailLog rows as sent when the SDK succeeds", async () => {
    process.env.RESEND_API_KEY = "re_fake_123456";
    const { campaignId, kolIds } = await seedWorld();
    sendMock.mockResolvedValue({
      data: { id: "msg_abc" },
      error: null,
    });
    const items = [
      {
        kolCampaignId: "",
        kolId: kolIds[0]!,
        toAddress: "kol0@example.test",
        subject: "Hi",
        bodyText: "body",
        templateId: null,
        aiCustomized: true,
      },
    ];
    const res = await batch.batchSendOutreach(
      TENANT,
      OWNER,
      campaignId,
      items,
      null,
      { skipSleep: true }
    );
    expect(res.sent).toBe(1);
    expect(res.items[0]!.providerMessageId).toBe("msg_abc");
    const log = await getAdminPrisma().emailLog.findFirstOrThrow({
      where: { tenantId: TENANT },
    });
    expect(log.status).toBe("sent");
    expect(log.aiCustomized).toBe(true);
    expect(log.providerMessageId).toBe("msg_abc");
  });

  it("records failed rows without advancing KolCampaign.status", async () => {
    process.env.RESEND_API_KEY = "re_fake_123456";
    const { campaignId, kolIds } = await seedWorld();
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "bad recipient" },
    });
    const items = [
      {
        kolCampaignId: "",
        kolId: kolIds[0]!,
        toAddress: "kol0@example.test",
        subject: "Hi",
        bodyText: "body",
        templateId: null,
      },
    ];
    const res = await batch.batchSendOutreach(
      TENANT,
      OWNER,
      campaignId,
      items,
      null,
      { skipSleep: true }
    );
    expect(res.failed).toBe(1);
    expect(res.items[0]!.status).toBe("failed");
    expect(res.items[0]!.error).toContain("provider_error");

    const log = await getAdminPrisma().emailLog.findFirstOrThrow({
      where: { tenantId: TENANT },
    });
    expect(log.status).toBe("failed");

    // No status change when the send fails.
    const links = await getAdminPrisma().kolCampaign.findMany({
      where: { tenantId: TENANT, campaignId },
    });
    expect(links.every((l) => l.status === "pending")).toBe(true);
  });
});

describe("analytics helpers", () => {
  it("runEmailQuickStats aggregates counts from EmailLog", async () => {
    const { campaignId, kolIds } = await seedWorld();
    const admin = getAdminPrisma();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86_400_000);
    await admin.emailLog.createMany({
      data: [
        {
          tenantId: TENANT,
          campaignId,
          kolId: kolIds[0],
          toAddress: "x@example.test",
          fromAddress: "marketer@kolquest.com",
          subject: "Hi",
          bodyHtml: "Hi",
          status: "sent",
          sentAt: dayAgo,
          openedAt: dayAgo,
          createdAt: dayAgo,
        },
        {
          tenantId: TENANT,
          campaignId,
          kolId: kolIds[1],
          toAddress: "x2@example.test",
          fromAddress: "marketer@kolquest.com",
          subject: "Hi",
          bodyHtml: "Hi",
          status: "bounced",
          sentAt: null,
          createdAt: dayAgo,
        },
      ],
    });

    const stats = await analytics.runEmailQuickStats(TENANT);
    expect(stats.totalSent30d).toBeGreaterThanOrEqual(1);
    expect(stats.openRatePercent).not.toBeNull();
    expect(stats.bounceRatePercent).not.toBeNull();
    expect(stats.deliverabilityPercent).not.toBeNull();
  });

  it("runRecentlySent returns rows sorted by sentAt DESC", async () => {
    const { campaignId, kolIds } = await seedWorld();
    const admin = getAdminPrisma();
    await admin.emailLog.createMany({
      data: [
        {
          tenantId: TENANT,
          campaignId,
          kolId: kolIds[0],
          toAddress: "a@example.test",
          fromAddress: "marketer@kolquest.com",
          subject: "Older",
          bodyHtml: "b",
          status: "sent",
          sentAt: new Date(Date.now() - 60_000),
        },
        {
          tenantId: TENANT,
          campaignId,
          kolId: kolIds[1],
          toAddress: "b@example.test",
          fromAddress: "marketer@kolquest.com",
          subject: "Newer",
          bodyHtml: "b",
          status: "sent",
          sentAt: new Date(),
        },
      ],
    });
    const rows = await analytics.runRecentlySent(TENANT, 10);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]!.subject).toBe("Newer");
  });
});
