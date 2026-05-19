import { describe, expect, it, vi } from "vitest";

// actions.ts is a "use server" file that imports prisma + email helpers
// at module scope; mock prevents Prisma client init during unit test.
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/email/access-request", () => ({
  sendAccessRequestNotification: vi.fn(),
}));

import { AccessRequestSchema } from "@/app/[locale]/request-access/actions";

describe("AccessRequestSchema.wantsDemo", () => {
  const base = {
    firstName: "A",
    lastName: "B",
    email: "a@b.com",
    company: "Acme",
    role: "founder" as const,
    campaignsPerQuarter: "0-5" as const,
  };

  it("parses wantsDemo='on' to true", () => {
    const r = AccessRequestSchema.parse({ ...base, wantsDemo: "on" });
    expect(r.wantsDemo).toBe(true);
  });

  it("parses missing wantsDemo to false", () => {
    const r = AccessRequestSchema.parse({ ...base });
    expect(r.wantsDemo).toBe(false);
  });

  it("parses wantsDemo='false' to false", () => {
    const r = AccessRequestSchema.parse({ ...base, wantsDemo: "false" });
    expect(r.wantsDemo).toBe(false);
  });

  it("parses wantsDemo='true' to true", () => {
    const r = AccessRequestSchema.parse({ ...base, wantsDemo: "true" });
    expect(r.wantsDemo).toBe(true);
  });
});
