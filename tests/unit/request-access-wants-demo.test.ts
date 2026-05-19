import { describe, expect, it, vi } from "vitest";

// Mock server-side imports so the schema can be tested in unit context
// without a live DB or email provider.
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/email/access-request", () => ({
  sendAccessRequestNotification: vi.fn(),
}));

// Re-import the schema once it's exported (Step 4). Until then this
// import will fail at compile time — that IS the failing test.
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
});
