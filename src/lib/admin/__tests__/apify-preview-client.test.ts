/**
 * BL-012-F002 · Apify-KOL preview fetch client unit specs.
 *
 * Covers the three branches the spec calls out (success / 401 unauthorized
 * / zod parse failure) plus a 429 rate-limit case so the kind surface is
 * exercised. Uses an in-test fetch double — no real network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApifyPreviewError,
  fetchApifyKolPage,
} from "../apify-preview-client";

const BASE = "http://apify.test:3003";
const KEY = "test-business-key";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("APIFY_KOL_BASE_URL", BASE);
  vi.stubEnv("APIFY_KOL_BUSINESS_API_KEY", KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("BL-012-F002 fetchApifyKolPage", () => {
  it("fetches /kol with x-api-key header and parses a valid page", async () => {
    const fetchSpy = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toBe(`${BASE}/kol?platform=tiktok&page=1&pageSize=50&sort=recent`);
      const headers = new Headers(init?.headers);
      expect(headers.get("x-api-key")).toBe(KEY);
      expect(init?.method).toBe("GET");
      return jsonResponse({
        data: [
          {
            id: "row-1",
            platform: "tiktok",
            platformUserId: "12345",
            username: "ninjawarrior",
            displayName: "Ninja Warrior",
            followers: 250_000,
            verified: true,
            emails: ["press@ninja.gg"],
            relevanceScore: 0.82,
            influenceScore: 0.71,
            qualityScore: 0.6,
            reachabilityScore: 0.45,
            matchedTags: ["gaming", "esports"],
          },
        ],
        page: 1,
        pageSize: 50,
        total: 1,
      });
    });

    const result = await fetchApifyKolPage(
      { platform: "tiktok", page: 1, pageSize: 50, sort: "recent" },
      { fetch: fetchSpy as unknown as typeof fetch }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.username).toBe("ninjawarrior");
    expect(result.raw).toMatchObject({ page: 1, pageSize: 50 });
  });

  it("throws an unauthorized ApifyPreviewError when the upstream returns 401", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ error: "missing api key" }, { status: 401 })
    );

    await expect(
      fetchApifyKolPage({}, { fetch: fetchSpy as unknown as typeof fetch })
    ).rejects.toMatchObject({
      name: "ApifyPreviewError",
      kind: "unauthorized",
      status: 401,
    });
  });

  it("throws a parse ApifyPreviewError when the response shape is invalid", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({
        data: [{ id: "row-1" /* missing platform/platformUserId/username */ }],
        page: 1,
        pageSize: 50,
        total: 1,
      })
    );

    await expect(
      fetchApifyKolPage({}, { fetch: fetchSpy as unknown as typeof fetch })
    ).rejects.toBeInstanceOf(ApifyPreviewError);

    await expect(
      fetchApifyKolPage({}, { fetch: fetchSpy as unknown as typeof fetch })
    ).rejects.toMatchObject({ kind: "parse" });
  });

  it("throws a rate_limit ApifyPreviewError on HTTP 429", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({}, { status: 429 }));

    await expect(
      fetchApifyKolPage({}, { fetch: fetchSpy as unknown as typeof fetch })
    ).rejects.toMatchObject({ kind: "rate_limit", status: 429 });
  });

  it("throws a config ApifyPreviewError when APIFY_KOL_BASE_URL is missing", async () => {
    vi.stubEnv("APIFY_KOL_BASE_URL", "");

    await expect(fetchApifyKolPage({})).rejects.toMatchObject({ kind: "config" });
  });

  // BL-012-F002 fix-round 2 (2026-05-08 prod report): the audit-time sample
  // only carried plain-string externalUrls + record-shaped aggregatorLinks,
  // but real fork rows ship `[{url, title, ...}]` for the former and array
  // of objects for the latter. The two cases below pin both wide variants
  // — they would have failed against the original schema and proved the
  // bug fix end-to-end.
  it("accepts externalUrls as an array of {url, title} objects (real IG bio_links shape)", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            id: "row-bio",
            platform: "instagram",
            platformUserId: "9999",
            username: "biolinker",
            externalUrls: [
              { url: "https://example.com/store", title: "Store" },
              { url: "https://example.com/yt", title: "YouTube" },
              "https://plain-string-still-works.example",
            ],
          },
        ],
        page: 1,
        pageSize: 50,
        total: 1,
      })
    );

    const result = await fetchApifyKolPage(
      {},
      { fetch: fetchSpy as unknown as typeof fetch }
    );
    expect(result.data).toHaveLength(1);
    const externalUrls = result.data[0]?.externalUrls;
    expect(Array.isArray(externalUrls)).toBe(true);
    expect(externalUrls?.[0]).toMatchObject({ url: "https://example.com/store" });
    expect(externalUrls?.[2]).toBe("https://plain-string-still-works.example");
  });

  it("accepts aggregatorLinks as either a record map or an array of objects", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            id: "row-array",
            platform: "tiktok",
            platformUserId: "1111",
            username: "arraylinks",
            aggregatorLinks: [
              { type: "youtube", url: "https://yt.example" },
              { type: "twitter", url: "https://t.example" },
            ],
          },
          {
            id: "row-record",
            platform: "youtube",
            platformUserId: "2222",
            username: "recordlinks",
            aggregatorLinks: { youtube: "https://yt.example", twitter: "https://t.example" },
          },
        ],
        page: 1,
        pageSize: 50,
        total: 2,
      })
    );

    const result = await fetchApifyKolPage(
      {},
      { fetch: fetchSpy as unknown as typeof fetch }
    );
    expect(result.data).toHaveLength(2);
    expect(Array.isArray(result.data[0]?.aggregatorLinks)).toBe(true);
    expect(typeof result.data[1]?.aggregatorLinks).toBe("object");
    expect(Array.isArray(result.data[1]?.aggregatorLinks)).toBe(false);
  });
});
