/**
 * BL-035-F003 — rate-limit wiring smoke tests for the 5 server-action
 * surfaces (`generateRoiInsightsAction`, `generateDatabaseInsightsAction`,
 * `generateWeeklyReportAction`, `sendBatchAction`) plus the
 * `/api/kols/smart-match` route handler.
 *
 * Each spec confirms that when the rate limiter rejects the call, the
 * action / route returns the canonical `rate_limit_exceeded` shape with
 * `retryAfter` and never reaches the downstream side-effects (no DB
 * read, no AI call). `generateAssetAction` has its own equivalent
 * spec in `src/app/[locale]/(app)/assets/__tests__/actions.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const withTenantMock = vi.fn(
  async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => fn({}),
);
vi.mock("@/lib/db", () => ({
  withTenant: (...args: unknown[]) =>
    withTenantMock(args[0] as string, args[1] as (tx: unknown) => Promise<unknown>),
}));

const logEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/events/log", () => ({
  logEvent: (...args: unknown[]) => logEventMock(...args),
}));

const rateLimitAiMock = vi
  .fn<() => Promise<{ ok: true; remaining: number } | { ok: false; retryAfter: number }>>()
  .mockResolvedValue({ ok: true, remaining: 9 });
vi.mock("@/lib/rate-limit-ai", () => ({
  rateLimitAi: () => rateLimitAiMock(),
}));

const rateLimitBatchMock = vi
  .fn<() => Promise<{ ok: true; remaining: number } | { ok: false; retryAfter: number }>>()
  .mockResolvedValue({ ok: true, remaining: 19 });
vi.mock("@/lib/rate-limit-batch", () => ({
  rateLimitBatchSend: () => rateLimitBatchMock(),
}));

// Heavy downstream mocks — these MUST never be hit when the rate
// limiter blocks; the assertions below verify that.
const generateRoiInsightsMock = vi.fn();
const loadRoiSummaryMock = vi.fn();
const loadRoiCampaignsMock = vi.fn();
vi.mock("@/lib/roi/insights", async () => {
  const actual = await vi.importActual<typeof import("@/lib/roi/insights")>(
    "@/lib/roi/insights",
  );
  return {
    ...actual,
    generateRoiInsights: (...args: unknown[]) => generateRoiInsightsMock(...args),
  };
});
vi.mock("@/lib/roi/queries", () => ({
  loadRoiSummary: (...args: unknown[]) => loadRoiSummaryMock(...args),
  loadRoiCampaigns: (...args: unknown[]) => loadRoiCampaignsMock(...args),
}));

// BL-065-F006 — generateDatabaseInsightsAction was tied to the
// DatabaseInsightsClient panel inside /database, both deleted with the
// folder. The rate-limit gate it exercised is also exercised by the
// remaining /roi + /weekly-report + /outreach actions, so coverage is
// preserved by the surviving cases below.

const assembleWeeklyReportInputMock = vi.fn();
const generateWeeklyReportMock = vi.fn();
const upsertWeeklyReportMock = vi.fn();
vi.mock("@/lib/weekly-report/data-assembly", async () => {
  const actual = await vi.importActual<typeof import("@/lib/weekly-report/data-assembly")>(
    "@/lib/weekly-report/data-assembly",
  );
  return {
    ...actual,
    assembleWeeklyReportInput: (...args: unknown[]) => assembleWeeklyReportInputMock(...args),
  };
});
vi.mock("@/lib/weekly-report/generate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/weekly-report/generate")>(
    "@/lib/weekly-report/generate",
  );
  return {
    ...actual,
    generateWeeklyReport: (...args: unknown[]) => generateWeeklyReportMock(...args),
  };
});
vi.mock("@/lib/weekly-report/persistence", () => ({
  upsertWeeklyReport: (...args: unknown[]) => upsertWeeklyReportMock(...args),
  attachShareToken: vi.fn(),
}));

const batchSendOutreachMock = vi.fn();
vi.mock("@/lib/email/batch-send", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/batch-send")>(
    "@/lib/email/batch-send",
  );
  return {
    ...actual,
    batchSendOutreach: (...args: unknown[]) => batchSendOutreachMock(...args),
  };
});

const runSmartMatchMock = vi.fn();
vi.mock("@/lib/discovery/smart-match", async () => {
  const actual = await vi.importActual<typeof import("@/lib/discovery/smart-match")>(
    "@/lib/discovery/smart-match",
  );
  return {
    ...actual,
    runSmartMatch: (...args: unknown[]) => runSmartMatchMock(...args),
  };
});

const { generateRoiInsightsAction } = await import("@/app/[locale]/(app)/roi/actions");
const { generateWeeklyReportAction } = await import(
  "@/app/[locale]/(app)/insight/weekly-report/actions"
);
const { sendBatchAction } = await import("@/app/[locale]/(app)/reach/actions");
const { POST: smartMatchPOST } = await import("@/app/api/kols/smart-match/route");

const TENANT = "11111111-2222-3333-4444-555555555555";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({
    user: { tenantId: TENANT, id: USER, name: "Marketer" },
  });
  withTenantMock.mockReset();
  logEventMock.mockReset().mockResolvedValue(undefined);

  rateLimitAiMock.mockReset().mockResolvedValue({ ok: true, remaining: 9 });
  rateLimitBatchMock.mockReset().mockResolvedValue({ ok: true, remaining: 19 });

  generateRoiInsightsMock.mockReset();
  loadRoiSummaryMock.mockReset();
  loadRoiCampaignsMock.mockReset();
  assembleWeeklyReportInputMock.mockReset();
  generateWeeklyReportMock.mockReset();
  upsertWeeklyReportMock.mockReset();
  batchSendOutreachMock.mockReset();
  runSmartMatchMock.mockReset();
});

describe("BL-035-F003 — server-action rate-limit wiring", () => {
  it("generateRoiInsightsAction returns rate_limit_exceeded and skips data load + AI call", async () => {
    rateLimitAiMock.mockResolvedValueOnce({ ok: false, retryAfter: 33 });
    const res = await generateRoiInsightsAction("en");
    expect(res).toEqual({ ok: false, error: "rate_limit_exceeded", retryAfter: 33 });
    expect(loadRoiSummaryMock).not.toHaveBeenCalled();
    expect(loadRoiCampaignsMock).not.toHaveBeenCalled();
    expect(generateRoiInsightsMock).not.toHaveBeenCalled();
  });

  // BL-065-F006 — generateDatabaseInsightsAction was deleted with the
  // /database route. The rate-limit gate it covered is still asserted
  // by the surviving roi / weekly-report / outreach / smart-match cases
  // below.

it("generateWeeklyReportAction returns rate_limit_exceeded and skips data assembly + AI call", async () => {
    rateLimitAiMock.mockResolvedValueOnce({ ok: false, retryAfter: 99 });
    const res = await generateWeeklyReportAction(new Date().toISOString(), "en");
    expect(res).toEqual({ ok: false, error: "rate_limit_exceeded", retryAfter: 99 });
    expect(assembleWeeklyReportInputMock).not.toHaveBeenCalled();
    expect(generateWeeklyReportMock).not.toHaveBeenCalled();
  });

  it("sendBatchAction returns rate_limit_exceeded and skips batchSendOutreach", async () => {
    rateLimitBatchMock.mockResolvedValueOnce({ ok: false, retryAfter: 7 });
    const res = await sendBatchAction({
      campaignId: "11111111-2222-3333-4444-555555555555",
      items: [
        {
          kolId: "22222222-3333-4444-5555-666666666666",
          toAddress: "kol@example.com",
          subject: "Hi",
          bodyText: "Body",
        },
      ],
    } as Parameters<typeof sendBatchAction>[0]);
    expect(res).toMatchObject({ ok: false, error: "rate_limit_exceeded", retryAfter: 7 });
    expect(batchSendOutreachMock).not.toHaveBeenCalled();
  });
});

describe("BL-035-F003 — /api/kols/smart-match rate-limit wiring", () => {
  it("returns 429 with Retry-After when the rate limiter blocks", async () => {
    rateLimitAiMock.mockResolvedValueOnce({ ok: false, retryAfter: 27 });
    const req = new Request("https://example.test/api/kols/smart-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "prod-1" }),
    });
    const res = await smartMatchPOST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("27");
    expect(await res.json()).toEqual({ error: "rate_limit_exceeded", retryAfter: 27 });
    expect(runSmartMatchMock).not.toHaveBeenCalled();
  });
});
