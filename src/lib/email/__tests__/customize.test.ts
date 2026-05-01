import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  process.env.AIGCGATEWAY_API_KEY = "pk_test";
  process.env.AIGCGATEWAY_BASE_URL = "https://aigc.example.test/v1";
});

afterEach(() => {
  delete process.env.AIGCGATEWAY_API_KEY;
  delete process.env.AIGCGATEWAY_BASE_URL;
});

async function importCustomize() {
  return import("../customize");
}

const baseInput = {
  product: { name: "Nebula", category: "MOBA", usp: "Cross-platform" },
  kol: { name: "Luna", handle: "luna_plays", region: "US", categories: ["MOBA"] },
  template: { subject: "Hi {{kol.name}}", body: "About {{product.name}}", locale: "en" as const },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("customizeEmail", () => {
  it("parses a fenced JSON response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        output:
          '```json\n{"subject":"Hello Luna","body":"Made for you","rationale":"personalized"}\n```',
        traceId: "trc_1",
      })
    );
    const { customizeEmail } = await importCustomize();
    const res = await customizeEmail(baseInput);
    expect(res.subject).toBe("Hello Luna");
    expect(res.body).toBe("Made for you");
    expect(res.traceId).toBe("trc_1");
    expect(res.rationale).toBe("personalized");
  });

  it("parses a plain-JSON response (no fence)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        output: '{"subject":"Plain","body":"JSON"}',
      })
    );
    const { customizeEmail } = await importCustomize();
    const res = await customizeEmail(baseInput);
    expect(res.subject).toBe("Plain");
    expect(res.body).toBe("JSON");
  });

  it("throws CustomizeEmailError when API returns 5xx after retry", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "internal_error" }, 503));
    const { customizeEmail, CustomizeEmailError } = await importCustomize();
    await expect(customizeEmail(baseInput)).rejects.toBeInstanceOf(CustomizeEmailError);
    expect(fetchMock).toHaveBeenCalledTimes(2); // original + 1 retry
  });

  it("throws invalid_response when output missing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const { customizeEmail } = await importCustomize();
    await expect(customizeEmail(baseInput)).rejects.toMatchObject({
      name: "CustomizeEmailError",
      code: "invalid_response",
    });
  });

  it("throws invalid_response when JSON cannot be parsed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ output: "not even close to JSON" }));
    const { customizeEmail } = await importCustomize();
    await expect(customizeEmail(baseInput)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("throws missing_env when API key is absent", async () => {
    delete process.env.AIGCGATEWAY_API_KEY;
    const { customizeEmail } = await importCustomize();
    await expect(customizeEmail(baseInput)).rejects.toMatchObject({
      code: "missing_env",
    });
  });
});

// ---------------------------------------------------------------------------
// verifying-2026-05-01-round-2 fix C-10 round 3 contract test.
//
// aigcgateway action `cmob2z6j00001bnole7i8lg9h` declares 10 required
// variables. If the code drifts on key names we get a 400 with
// "Missing required variable: <name>" → the user sees
// "AI service could not respond" — exactly Reviewer's prod L2
// round-2 blocker. Lock the wire-format key set + the key→input
// mapping so future renames surface as a unit-test failure, not a
// prod outage.
//
// Driven via the exported `toVariables` (pure helper) instead of
// going through the full customizeEmail → fetch path because
// vitest's vi.stubGlobal('fetch', ...) interacts unreliably with
// MSW's interceptor when the test wants to read the request body.
// ---------------------------------------------------------------------------

describe("toVariables / KOL_EMAIL_CUSTOMIZE_VARIABLE_KEYS contract", () => {
  it("emits exactly the 10 canonical keys the gateway action expects", async () => {
    const { toVariables, KOL_EMAIL_CUSTOMIZE_VARIABLE_KEYS } = await importCustomize();
    const out = toVariables(baseInput);
    expect(Object.keys(out).sort()).toEqual([...KOL_EMAIL_CUSTOMIZE_VARIABLE_KEYS].sort());
  });

  it("uses original_subject / original_body (not template_*) for the template fields", async () => {
    const { toVariables } = await importCustomize();
    const out = toVariables(baseInput);
    expect(out.original_subject).toBe(baseInput.template.subject);
    expect(out.original_body).toBe(baseInput.template.body);
    expect(out).not.toHaveProperty("template_subject");
    expect(out).not.toHaveProperty("template_body");
  });

  it("coerces optional KOL fields to empty strings instead of undefined", async () => {
    const { toVariables } = await importCustomize();
    const out = toVariables({
      product: { name: "P", usp: "U" },
      kol: { name: "K" },
      template: { subject: "S", body: "B", locale: "en" },
    });
    expect(out.product_category).toBe("");
    expect(out.kol_handle).toBe("");
    expect(out.kol_region).toBe("");
    expect(out.kol_categories).toBe("");
  });
});
