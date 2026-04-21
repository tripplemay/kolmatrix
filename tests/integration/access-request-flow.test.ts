/**
 * BAux1-F004 · access-request Server Action integration suite
 *
 * Exercises `submitAccessRequest` end-to-end against the Testcontainers
 * DB + MSW-mocked Resend endpoint:
 *   1. valid FormData → DB row created + Resend called
 *   2. missing ToS checkbox → ok:false / tos_required, no DB write
 *   3. Zod validation failure (email too short / role not in enum) → ok:false
 *      with invalid_input, no DB write
 *   4. same email within 24h → silent dedupe (ok:true, no second Resend call)
 *   5. same email after the 24h window → upsert + Resend called again
 *
 * The Server Action imports `prisma` (src/lib/db) which reads
 * DATABASE_URL at module-init time. `setupTestDb()` mutates
 * process.env.DATABASE_URL BEFORE we import the action, then we
 * dynamic-import the action so the Prisma singleton captures the
 * container URL. Without this dance, the base Prisma singleton would
 * point at whatever DATABASE_URL was in the env at Vitest boot.
 */
import { HttpResponse, http } from "msw";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { server } from "../mocks/server";
import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

type SubmitFn = typeof import("../../src/app/[locale]/request-access/actions").submitAccessRequest;

let submit: SubmitFn;

const SUCCESS_STATE = { ok: false } as const;

function validFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    firstName: "Sarah",
    lastName: "Chen",
    email: "sarah@neonlaunch.test",
    company: "Neon Launch Studio",
    role: "marketing-manager",
    campaignsPerQuarter: "6-20",
    games: "Astra: Midnight Gauntlet",
    tosAccepted: "on",
  };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) {
    fd.set(k, v);
  }
  return fd;
}

let resendCalls = 0;

beforeAll(async () => {
  await setupTestDb();
  process.env.RESEND_API_KEY = "re_test_key";
  server.listen({ onUnhandledRequest: "warn" });
  server.use(
    http.post("https://api.resend.com/emails", () => {
      resendCalls += 1;
      return HttpResponse.json(
        { id: `msg_mock_${resendCalls}` },
        { status: 200 }
      );
    })
  );
  // Dynamic import AFTER setupTestDb has set DATABASE_URL so the Prisma
  // singleton inside src/lib/db.ts connects to the Testcontainers URL.
  const mod = await import("../../src/app/[locale]/request-access/actions");
  submit = mod.submitAccessRequest;
});

afterAll(async () => {
  server.close();
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  resendCalls = 0;
  server.resetHandlers();
  server.use(
    http.post("https://api.resend.com/emails", () => {
      resendCalls += 1;
      return HttpResponse.json(
        { id: `msg_mock_${resendCalls}` },
        { status: 200 }
      );
    })
  );
});

describe("submitAccessRequest", () => {
  it("persists a new access_request row and notifies admin on valid input", async () => {
    const result = await submit(SUCCESS_STATE, validFormData());
    expect(result.ok).toBe(true);

    const admin = getAdminPrisma();
    const row = await admin.accessRequest.findUnique({
      where: { email: "sarah@neonlaunch.test" },
    });
    expect(row).not.toBeNull();
    expect(row?.firstName).toBe("Sarah");
    expect(row?.lastName).toBe("Chen");
    expect(row?.company).toBe("Neon Launch Studio");
    expect(row?.role).toBe("marketing-manager");
    expect(row?.campaignsPerQuarter).toBe("6-20");
    expect(row?.status).toBe("pending");
    expect(resendCalls).toBe(1);
  });

  it("refuses to submit without ToS accepted and writes nothing", async () => {
    const fd = validFormData();
    fd.delete("tosAccepted");
    const result = await submit(SUCCESS_STATE, fd);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("tos_required");

    const admin = getAdminPrisma();
    const row = await admin.accessRequest.findUnique({
      where: { email: "sarah@neonlaunch.test" },
    });
    expect(row).toBeNull();
    expect(resendCalls).toBe(0);
  });

  it("returns invalid_input when Zod rejects an enum value", async () => {
    const result = await submit(
      SUCCESS_STATE,
      validFormData({ role: "not-a-valid-role" })
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_input");
    expect(resendCalls).toBe(0);
  });

  it("returns invalid_input when email is malformed", async () => {
    const result = await submit(
      SUCCESS_STATE,
      validFormData({ email: "not-an-email" })
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_input");
    expect(resendCalls).toBe(0);
  });

  it("silently dedupes a re-submission from the same email inside 24h (no new email)", async () => {
    // First submission seeds the row.
    await submit(SUCCESS_STATE, validFormData());
    expect(resendCalls).toBe(1);

    // Second submission within 24h — same email, possibly different company.
    const result = await submit(
      SUCCESS_STATE,
      validFormData({ company: "Different Studio Inc." })
    );
    expect(result.ok).toBe(true);
    expect(resendCalls).toBe(1); // no second notification — silent dedupe

    const admin = getAdminPrisma();
    const rows = await admin.accessRequest.findMany({
      where: { email: "sarah@neonlaunch.test" },
    });
    expect(rows).toHaveLength(1);
    // Original company preserved — silent dedupe means no update.
    expect(rows[0].company).toBe("Neon Launch Studio");
  });

  it("re-notifies when the same email resubmits after the 24h window", async () => {
    await submit(SUCCESS_STATE, validFormData());
    expect(resendCalls).toBe(1);

    // Age the existing row past 24h by hand-rolling createdAt in the DB.
    const admin = getAdminPrisma();
    const past = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await admin.accessRequest.update({
      where: { email: "sarah@neonlaunch.test" },
      data: { createdAt: past },
    });

    const result = await submit(
      SUCCESS_STATE,
      validFormData({ company: "Different Studio Inc." })
    );
    expect(result.ok).toBe(true);
    expect(resendCalls).toBe(2);

    const row = await admin.accessRequest.findUnique({
      where: { email: "sarah@neonlaunch.test" },
    });
    expect(row?.company).toBe("Different Studio Inc.");
    expect(row?.status).toBe("pending");
  });

  it("still returns ok:true when Resend fails (DB write is source of truth)", async () => {
    server.resetHandlers();
    server.use(
      http.post("https://api.resend.com/emails", () =>
        HttpResponse.json({ error: "rate_limited" }, { status: 429 })
      )
    );
    const result = await submit(SUCCESS_STATE, validFormData());
    expect(result.ok).toBe(true);

    const admin = getAdminPrisma();
    const row = await admin.accessRequest.findUnique({
      where: { email: "sarah@neonlaunch.test" },
    });
    expect(row).not.toBeNull();
  });
});

