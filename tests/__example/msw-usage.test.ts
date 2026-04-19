/**
 * Example / contract test for the MSW setup. Not a product assertion —
 * it exists so that a future dev can see how to:
 *   1) rely on the default handler (aigcgateway returns score 87)
 *   2) hit Resend's default handler (returns a mock message id)
 *   3) override a handler for a single request to simulate 500 errors
 *
 * Runs under `npm run test:unit` because the unit vitest config
 * includes `tests/__example/**`.
 */
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { MOCK_BASE_URLS } from "../mocks/handlers";
import { server } from "../mocks/server";

describe("MSW default handlers", () => {
  it("aigcgateway /v1/evaluate returns the default mock score", async () => {
    const res = await fetch(`${MOCK_BASE_URLS.aigcgateway}/v1/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kolId: "kol_demo" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { score: number; breakdown: Record<string, number> };
    expect(body.score).toBe(87);
    expect(body.breakdown.relevance).toBeCloseTo(0.92);
  });

  it("Resend /emails returns a mock message id with msg_mock_ prefix", async () => {
    const res = await fetch(`${MOCK_BASE_URLS.resend}/emails`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "x@example.com", subject: "hi", html: "hi" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^msg_mock_/);
  });
});

describe("MSW handler override", () => {
  it("server.use(...once()) replaces the default handler for a single call", async () => {
    server.use(
      http.post(
        `${MOCK_BASE_URLS.aigcgateway}/v1/evaluate`,
        () => HttpResponse.json({ error: "internal_error" }, { status: 500 }),
        { once: true }
      )
    );

    const failing = await fetch(`${MOCK_BASE_URLS.aigcgateway}/v1/evaluate`, {
      method: "POST",
      body: "{}",
    });
    expect(failing.status).toBe(500);

    // Subsequent call falls back to the default handler (score 87) because
    // the override was `.once()` and afterEach will also resetHandlers for
    // safety.
    const recovered = await fetch(`${MOCK_BASE_URLS.aigcgateway}/v1/evaluate`, {
      method: "POST",
      body: "{}",
    });
    expect(recovered.status).toBe(200);
    const body = (await recovered.json()) as { score: number };
    expect(body.score).toBe(87);
  });
});
