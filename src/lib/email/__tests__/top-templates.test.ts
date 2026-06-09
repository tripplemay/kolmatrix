/**
 * BL-099-F004 · runTopTemplates reads the template name from the
 * email_log.template_name snapshot (ADR-018 D2) instead of joining
 * email_template (which F005 drops). DB mocked at the module boundary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTx = {
  emailLog: {
    groupBy: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) => fn(mockTx),
}));

const { runTopTemplates } = await import("../analytics");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BL-099-F004 runTopTemplates template_name snapshot", () => {
  it("reads the name from the email_log snapshot and never joins email_template", async () => {
    mockTx.emailLog.groupBy.mockResolvedValueOnce([
      { templateId: "t1", _count: { _all: 5 } },
    ]);
    mockTx.emailLog.count.mockResolvedValueOnce(2); // opened
    mockTx.emailLog.findFirst.mockResolvedValueOnce({ templateName: "Welcome (snapshot)" });

    const rows = await runTopTemplates("tenant-a", 3);

    expect(rows).toEqual([
      { templateId: "t1", name: "Welcome (snapshot)", usage: 5, openRate: 40 },
    ]);
    expect(mockTx.emailLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: "t1", templateName: { not: null } },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("returns [] when there are no template sends", async () => {
    mockTx.emailLog.groupBy.mockResolvedValueOnce([]);
    await expect(runTopTemplates("tenant-a")).resolves.toEqual([]);
  });

  it("name is null when no snapshot exists for the group", async () => {
    mockTx.emailLog.groupBy.mockResolvedValueOnce([
      { templateId: "t1", _count: { _all: 4 } },
    ]);
    mockTx.emailLog.count.mockResolvedValueOnce(0);
    mockTx.emailLog.findFirst.mockResolvedValueOnce(null);

    const rows = await runTopTemplates("tenant-a");

    expect(rows[0]?.name).toBeNull();
    expect(rows[0]?.usage).toBe(4);
    expect(rows[0]?.openRate).toBe(0);
  });
});
