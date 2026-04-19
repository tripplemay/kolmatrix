/**
 * Default MSW handlers for the two external HTTP surfaces B2+ will call:
 *   - aigcgateway  (AI scoring / email generation)
 *   - Resend        (transactional email)
 *
 * Tests that need to assert error paths call
 *   `server.use(http.post(...).once(...))`
 * to override these defaults for a single request. The `__example/` suite
 * demonstrates both shapes.
 *
 * URL strategy:
 *   Production code reads the base URL from env (AIGCGATEWAY_BASE_URL,
 *   and Resend is fixed at api.resend.com). Tests set their own base
 *   via MOCK_BASE_URLS below so the handlers intercept deterministically
 *   regardless of developer machine or CI. Tests that exercise real
 *   code paths should set `process.env.AIGCGATEWAY_BASE_URL =
 *   MOCK_BASE_URLS.aigcgateway` before importing the code under test.
 */
import { HttpResponse, http } from "msw";

export const MOCK_BASE_URLS = {
  aigcgateway: "https://aigcgateway.test",
  resend: "https://api.resend.com",
} as const;

export const handlers = [
  http.post(`${MOCK_BASE_URLS.aigcgateway}/v1/evaluate`, async () => {
    return HttpResponse.json(
      {
        score: 87,
        breakdown: {
          audience: 0.85,
          engagement: 0.78,
          relevance: 0.92,
        },
      },
      { status: 200 }
    );
  }),

  http.post(`${MOCK_BASE_URLS.resend}/emails`, async () => {
    const id = `msg_mock_${Math.random().toString(36).slice(2, 10)}`;
    return HttpResponse.json({ id }, { status: 200 });
  }),
];
