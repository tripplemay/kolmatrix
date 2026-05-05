/**
 * BL-025-F003 · Email generator unit specs.
 *
 * Stubs the aigcgateway HTTP layer with a fetch impl that returns a
 * canned chat-completion shape, then asserts that:
 *   - The Zod-validated EmailContent comes back as expected.
 *   - The dual-shape parser tolerates both bare {subject, body} and
 *     {emailTemplates:[{subject, body}]} envelopes.
 *   - Malformed JSON / missing required fields raise
 *     EmailContentParseError (not surface as silent empty content).
 *   - The locale override forces the asked-for locale onto the
 *     result (model occasionally drops it).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmailContentParseError, generateEmailContent, __TEST_ONLY__ } from "../email-generator";

beforeEach(() => {
  process.env.AIGCGATEWAY_BASE_URL = "https://aigc.test";
  process.env.AIGCGATEWAY_API_KEY = "k";
});

afterEach(() => {
  delete process.env.AIGCGATEWAY_BASE_URL;
  delete process.env.AIGCGATEWAY_API_KEY;
});

const product = {
  name: "Honor of Kings",
  category: "MOBA",
  targetAudience: "16-30 SEA",
  uniqueSellingPoints: "5v5 120Hz competitive",
};

function chatResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      id: "trace-1",
      model: "claude-haiku-4.5",
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 50, completion_tokens: 80, total_tokens: 130 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("generateEmailContent", () => {
  it("returns a Zod-validated EmailContent + usage when the model produces a bare object", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      chatResponse(
        JSON.stringify({
          subject: "Partner with HoK",
          body: "Hi {{kol.name}}, your gameplay matches our brand.",
          locale: "en",
          variables: [{ token: "{{kol.name}}", required: true }],
        })
      )
    );

    const result = await generateEmailContent({ product, fetchImpl });

    expect(result.content.subject).toBe("Partner with HoK");
    expect(result.content.locale).toBe("en");
    expect(result.usage.totalTokens).toBe(130);
    expect(result.traceId).toBe("trace-1");
    expect(result.model).toBe("claude-haiku-4.5");
  });

  it("tolerates the legacy {emailTemplates:[{subject, body}]} envelope shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      chatResponse(
        JSON.stringify({
          emailTemplates: [{ subject: "Hi", body: "Body", locale: "en", variables: [] }],
          videoScripts: [],
        })
      )
    );

    const result = await generateEmailContent({ product, fetchImpl });
    expect(result.content.subject).toBe("Hi");
  });

  it("forces the requested locale into the result when the model drops it", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      chatResponse(
        JSON.stringify({
          subject: "Hi",
          body: "Body",
          locale: "en",
          variables: [],
        })
      )
    );

    const result = await generateEmailContent({
      product,
      locale: "zh",
      fetchImpl,
    });
    expect(result.content.locale).toBe("zh");
  });

  it("throws EmailContentParseError on non-JSON content (no silent empty)", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(chatResponse("definitely not json"));

    await expect(generateEmailContent({ product, fetchImpl })).rejects.toBeInstanceOf(
      EmailContentParseError
    );
  });

  it("throws EmailContentParseError when required Zod fields are missing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(chatResponse(JSON.stringify({ subject: "no body" })));

    await expect(generateEmailContent({ product, fetchImpl })).rejects.toBeInstanceOf(
      EmailContentParseError
    );
  });

  it("__TEST_ONLY__.parseEmailContent injects defaults when locale/variables absent", () => {
    const out = __TEST_ONLY__.parseEmailContent(JSON.stringify({ subject: "Hi", body: "Body" }));
    expect(out.locale).toBe("en");
    expect(out.variables).toEqual([]);
  });

  it("BL-034 F006: rejects bracket-placeholder output via shared validateNoBracketPlaceholders", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      chatResponse(
        JSON.stringify({
          subject: "Hi [Creator Name]",
          body: "We loved your latest video.",
          locale: "en",
          variables: [],
        }),
      ),
    );
    await expect(generateEmailContent({ product, fetchImpl })).rejects.toThrow(
      /bracket placeholders/,
    );
  });
});
