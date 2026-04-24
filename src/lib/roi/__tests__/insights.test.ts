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

async function importInsights() {
  return import("../insights");
}

const baseInput = {
  campaigns: [
    {
      name: "Galactic Forge Alpha",
      product: "Galactic Forge",
      spendTotal: 100,
      revenueRecorded: 273,
      roiPercent: 173,
      startedAt: "2026-03-01T00:00:00Z",
      closedAt: "2026-04-01T00:00:00Z",
      kolCount: 4,
    },
  ],
  summary: {
    totalSpend: 100,
    totalRevenue: 273,
    avgRoiPercent: 173,
    topCampaignName: "Galactic Forge Alpha",
    topCampaignRoi: 173,
  },
  locale: "en" as const,
};

const goodPayload = {
  insights: [
    {
      title_en: "Galactic Forge High ROI",
      title_zh: "Galactic Forge 高 ROI",
      body_en: "Alpha launch exceeded expectations.",
      body_zh: "首测表现超预期。",
      severity: "positive",
    },
    {
      title_en: "Watch Spend",
      title_zh: "关注支出",
      body_en: "Spend is trending up week over week.",
      body_zh: "支出环比上升。",
      severity: "warning",
    },
    {
      title_en: "Steady Velocity",
      title_zh: "稳健节奏",
      body_en: "Conversions stable across the window.",
      body_zh: "窗口期内转化稳定。",
      severity: "neutral",
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("generateRoiInsights", () => {
  it("parses fenced JSON and resolves locale text (en)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        output: "```json\n" + JSON.stringify(goodPayload) + "\n```",
        traceId: "trc_en",
      })
    );
    const { generateRoiInsights } = await importInsights();
    const res = await generateRoiInsights(baseInput);
    expect(res.traceId).toBe("trc_en");
    expect(res.insights).toHaveLength(3);
    expect(res.insights[0]).toEqual({
      title: "Galactic Forge High ROI",
      body: "Alpha launch exceeded expectations.",
      tone: "positive",
    });
    expect(res.insights[1].tone).toBe("warning");
    expect(res.insights[2].tone).toBe("info"); // neutral → info
  });

  it("parses plain JSON (no fence) and resolves locale text (zh)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ output: JSON.stringify(goodPayload) })
    );
    const { generateRoiInsights } = await importInsights();
    const res = await generateRoiInsights({ ...baseInput, locale: "zh" });
    expect(res.insights[0].title).toBe("Galactic Forge 高 ROI");
    expect(res.insights[0].body).toBe("首测表现超预期。");
  });

  it("forwards the 3 required variables (tenant_context / campaigns_json / locale)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ output: JSON.stringify(goodPayload) })
    );
    const { generateRoiInsights } = await importInsights();
    await generateRoiInsights(baseInput);
    const call = fetchMock.mock.calls[0];
    const arg0 = call[0];
    const calledUrl =
      typeof arg0 === "string"
        ? arg0
        : arg0 instanceof URL
          ? arg0.toString()
          : (arg0 as Request).url;
    expect(calledUrl).toContain(
      "/actions/cmob2zgae000jbnnuue2i7uaf/run"
    );
    // Body lives either on init (string fetch call) or the Request (when
    // the Node runtime normalised our (url, init) into a Request).
    let bodyText: string;
    if (arg0 instanceof Request) {
      bodyText = await arg0.clone().text();
    } else {
      bodyText = String(call[1]?.body ?? "{}");
    }
    const body = JSON.parse(bodyText);
    expect(Object.keys(body.variables).sort()).toEqual([
      "campaigns_json",
      "locale",
      "tenant_context",
    ]);
    expect(body.dry_run).toBe(false);
    expect(body.variables.locale).toBe("en");
    expect(body.variables.tenant_context).toContain("Top campaign:");
  });

  it("retries once on 5xx then surfaces http_error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 503));
    const { generateRoiInsights, RoiInsightsError } = await importInsights();
    await expect(generateRoiInsights(baseInput)).rejects.toBeInstanceOf(
      RoiInsightsError
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "bad request" }, 400)
    );
    const { generateRoiInsights } = await importInsights();
    await expect(generateRoiInsights(baseInput)).rejects.toMatchObject({
      code: "http_error",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws invalid_response when output missing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const { generateRoiInsights } = await importInsights();
    await expect(generateRoiInsights(baseInput)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("throws invalid_response when JSON cannot be parsed", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ output: "not even close to JSON" })
    );
    const { generateRoiInsights } = await importInsights();
    await expect(generateRoiInsights(baseInput)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("throws invalid_response when zod schema fails (missing field)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        output: JSON.stringify({
          insights: [
            {
              title_en: "ok",
              title_zh: "ok",
              body_en: "ok",
              // body_zh missing
              severity: "positive",
            },
          ],
        }),
      })
    );
    const { generateRoiInsights } = await importInsights();
    await expect(generateRoiInsights(baseInput)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("throws invalid_response when severity is unknown", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        output: JSON.stringify({
          insights: [
            {
              title_en: "ok",
              title_zh: "ok",
              body_en: "ok",
              body_zh: "ok",
              severity: "purple", // invalid
            },
          ],
        }),
      })
    );
    const { generateRoiInsights } = await importInsights();
    await expect(generateRoiInsights(baseInput)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("throws missing_env when API key is absent", async () => {
    delete process.env.AIGCGATEWAY_API_KEY;
    const { generateRoiInsights } = await importInsights();
    await expect(generateRoiInsights(baseInput)).rejects.toMatchObject({
      code: "missing_env",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("toVariables", () => {
  it("composes the tenant_context summary line", async () => {
    const { toVariables } = await importInsights();
    const vars = toVariables(baseInput);
    expect(vars.tenant_context).toBe(
      "Gaming studio with 1 completed campaigns. Total spend $100, revenue $273, avg ROI 173.0%. Top campaign: Galactic Forge Alpha (173.0% ROI)."
    );
    expect(JSON.parse(vars.campaigns_json)).toEqual(baseInput.campaigns);
    expect(vars.locale).toBe("en");
  });

  it("renders 'No top campaign yet' when summary lacks one", async () => {
    const { toVariables } = await importInsights();
    const vars = toVariables({
      ...baseInput,
      summary: {
        ...baseInput.summary,
        topCampaignName: null,
        topCampaignRoi: null,
        avgRoiPercent: null,
      },
    });
    expect(vars.tenant_context).toContain("No top campaign yet.");
    expect(vars.tenant_context).toContain("avg ROI —%.");
  });
});
