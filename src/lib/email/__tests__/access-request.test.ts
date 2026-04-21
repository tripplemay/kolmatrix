/**
 * BAux1-F004 · access-request email helper unit suite
 *
 * Asserts Resend integration contract:
 *   - from = KOLMatrix Access <marketer@kolquest.com>   (root domain)
 *   - to   = [tripplezhou@gmail.com]
 *   - subject includes the company name
 *   - HTML body escapes dangerous characters + lists all 8 DB fields
 *
 * Resend is mocked via MSW. We capture the outbound request and assert
 * on its payload, rather than importing the real SDK's types (its types
 * churn across minor versions).
 */
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "../../../../tests/mocks/server";
import {
  __test__,
  sendAccessRequestNotification,
  type AccessRequestNotificationPayload,
} from "../access-request";

function makePayload(
  overrides: Partial<AccessRequestNotificationPayload> = {}
): AccessRequestNotificationPayload {
  return {
    id: "caccessreq000000000000000",
    email: "sarah@neonlaunch.test",
    firstName: "Sarah",
    lastName: "Chen",
    company: "Neon Launch",
    role: "marketing-manager",
    campaignsPerQuarter: "6-20",
    games: "Astra: Midnight Gauntlet",
    createdAt: new Date("2026-04-21T10:00:00Z"),
    ...overrides,
  };
}

describe("sendAccessRequestNotification", () => {
  it("posts a Resend email with the spec'd from / to / subject", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    let captured: {
      from?: string;
      to?: string[] | string;
      subject?: string;
      html?: string;
    } = {};
    server.use(
      http.post("https://api.resend.com/emails", async ({ request }) => {
        captured = (await request.json()) as typeof captured;
        return HttpResponse.json({ id: "msg_test" }, { status: 200 });
      })
    );

    const result = await sendAccessRequestNotification(makePayload());

    expect(result.ok).toBe(true);
    expect(captured.from).toBe(__test__.FROM_ADDRESS);
    expect(captured.from).toContain("marketer@kolquest.com");
    expect(captured.to).toEqual([__test__.ADMIN_INBOX]);
    expect(captured.to).toEqual(["tripplezhou@gmail.com"]);
    expect(captured.subject).toBe("[KOLMatrix] New access request: Neon Launch");
    expect(captured.html).toContain("sarah@neonlaunch.test");
    expect(captured.html).toContain("Neon Launch");
    expect(captured.html).toContain("Sarah Chen");
    expect(captured.html).toContain("marketing-manager");
    expect(captured.html).toContain("6-20");
    expect(captured.html).toContain("Astra: Midnight Gauntlet");
  });

  it("returns ok:false + logs when Resend responds with an error", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    server.use(
      http.post("https://api.resend.com/emails", () =>
        HttpResponse.json({ error: "rate_limited" }, { status: 429 })
      )
    );
    const result = await sendAccessRequestNotification(makePayload());
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("buildBodyHtml escapes HTML in user-supplied fields", () => {
    const html = __test__.buildBodyHtml(
      makePayload({
        company: "<script>alert('x')</script>",
        games: "A & B",
      })
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });
});
