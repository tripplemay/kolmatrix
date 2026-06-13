/**
 * BL-115-F001 · submitLead spec — form validation + lead persistence + the
 * landing.trial_request conversion event. Prisma + logEvent are mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { lead: { create: (...a: unknown[]) => createMock(...a) } } }));

const logEventMock = vi.fn();
vi.mock("@/lib/events/log", () => ({ logEvent: (...a: unknown[]) => logEventMock(...a) }));

import { submitLead } from "../submit-lead";

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

beforeEach(() => {
  createMock.mockReset().mockResolvedValue({ id: "lead_1" });
  logEventMock.mockReset();
});

describe("BL-115-F001 submitLead", () => {
  it("rejects invalid input with field errors and no DB write", async () => {
    const res = await submitLead({ ok: false }, fd({ name: "", email: "not-an-email", studio: "" }));
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid_input");
    expect(res.fieldErrors && Object.keys(res.fieldErrors).length).toBeGreaterThan(0);
    expect(createMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("persists a valid lead with UTM + emits the conversion event", async () => {
    const res = await submitLead(
      { ok: false },
      fd({
        name: "Ana",
        email: "ana@studio.example",
        studio: "Studio X",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "launch",
        referrer: "https://ads.example",
        landingPath: "/en",
      }),
    );
    expect(res.ok).toBe(true);
    expect(createMock).toHaveBeenCalledOnce();
    const data = (createMock.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.email).toBe("ana@studio.example");
    expect(data.studio).toBe("Studio X");
    expect(data.utmSource).toBe("google");
    expect(data.utmCampaign).toBe("launch");
    expect(logEventMock).toHaveBeenCalledOnce();
    expect((logEventMock.mock.calls[0][0] as { type: string }).type).toBe("landing.trial_request");
  });

  it("returns a generic error when the insert throws", async () => {
    createMock.mockRejectedValueOnce(new Error("db down"));
    const res = await submitLead({ ok: false }, fd({ name: "A", email: "a@b.co", studio: "S" }));
    expect(res.ok).toBe(false);
    expect(res.error).toBe("generic");
  });
});
