/**
 * BL-115-F001 · landing-event route spec — allow-listed 埋点 → event_log,
 * with garbage/oversized/unknown types rejected. logEvent is mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const logEventMock = vi.fn();
vi.mock("@/lib/events/log", () => ({ logEvent: (...a: unknown[]) => logEventMock(...a) }));

import { POST } from "../route";

function post(body: string): Request {
  return new Request("http://localhost/api/landing-event", { method: "POST", body });
}

beforeEach(() => logEventMock.mockReset());

describe("BL-115-F001 landing-event route", () => {
  it("logs an allow-listed event with a landing. prefix", async () => {
    const res = await POST(post(JSON.stringify({ type: "cta_click", payload: { cta: "hero" } })) as never);
    expect(res.status).toBe(204);
    expect(logEventMock).toHaveBeenCalledOnce();
    const arg = logEventMock.mock.calls[0][0] as { type: string; payload: Record<string, unknown> };
    expect(arg.type).toBe("landing.cta_click");
    expect(arg.payload.cta).toBe("hero");
  });

  it("ignores non-allow-listed event types", async () => {
    const res = await POST(post(JSON.stringify({ type: "evil.exfiltrate" })) as never);
    expect(res.status).toBe(204);
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("ignores oversized or non-JSON bodies", async () => {
    await POST(post("x".repeat(3000)) as never);
    await POST(post("not json at all") as never);
    expect(logEventMock).not.toHaveBeenCalled();
  });
});
