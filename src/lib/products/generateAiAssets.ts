/**
 * BM1-F003 · Product AI asset generator.
 *
 * Calls the aigcgateway /v1/chat/completions endpoint (OpenAI-compatible)
 * to produce 3 email templates + 2 video scripts for KOL outreach, then
 * stores them under `Product.aiAssets`. The server action fires this in
 * a non-awaited `.catch(...)` branch so generation never blocks the
 * product save (spec §F003: fire-and-forget + status tracking).
 *
 * BM2 will migrate this to an aigcgateway Action (`kol-asset-generate`);
 * keeping the prompt inline here avoids a BM1 ↔ aigcgateway Action
 * dependency during the MVP push.
 */
import { Prisma, withTenant } from "@/lib/db";

export interface GenerateAiAssetsInput {
  productId: string;
  tenantId: string;
  name: string;
  category: string;
  targetAudience: string | null;
  uniqueSellingPoints: string;
  downloadUrl: string | null;
}

export interface ProductAiAssetContent {
  emailTemplates: Array<{ subject: string; body: string }>;
  videoScripts: Array<{ title: string; script: string }>;
}

export type ProductAiAssets =
  | {
      status: "pending";
      requestedAt: string;
    }
  | (ProductAiAssetContent & {
      status: "ready";
      generatedAt: string;
      traceId?: string;
    })
  | {
      status: "failed";
      error: string;
      failedAt: string;
    };

const DEFAULT_MODEL = "claude-haiku-4.5";

/**
 * Mark the product row as "AI generation pending" so the card can show a
 * spinner chip while the background fetch is in flight. Runs inside the
 * tenant-scoped transaction to honor RLS.
 */
export async function markAiAssetsPending(
  tenantId: string,
  productId: string
): Promise<void> {
  const payload: ProductAiAssets = {
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  await withTenant(tenantId, (tx) =>
    tx.product.update({
      where: { id: productId },
      data: { aiAssets: payload as unknown as Prisma.InputJsonObject },
    })
  );
}

export async function generateAiAssets(
  input: GenerateAiAssetsInput,
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = process.env.AIGCGATEWAY_BASE_URL;
  const apiKey = process.env.AIGCGATEWAY_API_KEY;

  if (!baseUrl || !apiKey) {
    await writeFailure(
      input.tenantId,
      input.productId,
      "AIGCGATEWAY_BASE_URL or AIGCGATEWAY_API_KEY not configured"
    );
    return;
  }

  const userMessage =
    `Product name: ${input.name}\n` +
    `Category: ${input.category}\n` +
    `Target audience: ${input.targetAudience ?? "Not specified"}\n` +
    `Unique selling points: ${input.uniqueSellingPoints}\n` +
    (input.downloadUrl ? `Download URL: ${input.downloadUrl}\n` : "") +
    `\nGenerate exactly:\n` +
    `- 3 email templates (initial KOL outreach / follow-up / signing invitation): each with {subject, body} in markdown.\n` +
    `- 2 video scripts (60-second YouTube promo / 15-second TikTok short): each with {title, script}.\n` +
    `\nReturn strict JSON: { "emailTemplates": [{"subject": "...", "body": "..."}], "videoScripts": [{"title": "...", "script": "..."}] }.`;

  const body = {
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a marketing copywriter for gaming KOL outreach. Generate promotional assets for a game product. Always respond with valid JSON matching the schema provided.",
      },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  };

  try {
    const resp = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`aigcgateway responded ${resp.status}`);
    }
    const json = (await resp.json()) as {
      id?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) {
      throw new Error("aigcgateway response missing choices[0].message.content");
    }
    const parsed = parseAndValidate(raw);
    const assets: ProductAiAssets = {
      status: "ready",
      emailTemplates: parsed.emailTemplates,
      videoScripts: parsed.videoScripts,
      generatedAt: new Date().toISOString(),
      traceId: json.id,
    };

    await withTenant(input.tenantId, (tx) =>
      tx.product.update({
        where: { id: input.productId },
        data: { aiAssets: assets as unknown as Prisma.InputJsonObject },
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[generateAiAssets] product=${input.productId} failed:`,
      err
    );
    await writeFailure(input.tenantId, input.productId, message);
  }
}

function parseAndValidate(raw: string): ProductAiAssetContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("aigcgateway content is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("aigcgateway content is not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  const emails = obj.emailTemplates;
  const videos = obj.videoScripts;
  if (!Array.isArray(emails) || emails.length === 0) {
    throw new Error("emailTemplates missing or empty in AI response");
  }
  if (!Array.isArray(videos) || videos.length === 0) {
    throw new Error("videoScripts missing or empty in AI response");
  }
  const emailTemplates = emails.map((e, idx) => {
    if (
      typeof e !== "object" ||
      e === null ||
      typeof (e as Record<string, unknown>).subject !== "string" ||
      typeof (e as Record<string, unknown>).body !== "string"
    ) {
      throw new Error(`emailTemplates[${idx}] missing subject/body`);
    }
    const record = e as { subject: string; body: string };
    return { subject: record.subject, body: record.body };
  });
  const videoScripts = videos.map((v, idx) => {
    if (
      typeof v !== "object" ||
      v === null ||
      typeof (v as Record<string, unknown>).title !== "string" ||
      typeof (v as Record<string, unknown>).script !== "string"
    ) {
      throw new Error(`videoScripts[${idx}] missing title/script`);
    }
    const record = v as { title: string; script: string };
    return { title: record.title, script: record.script };
  });
  return { emailTemplates, videoScripts };
}

async function writeFailure(
  tenantId: string,
  productId: string,
  message: string
): Promise<void> {
  const payload: ProductAiAssets = {
    status: "failed",
    error: message,
    failedAt: new Date().toISOString(),
  };
  try {
    await withTenant(tenantId, (tx) =>
      tx.product.update({
        where: { id: productId },
        data: { aiAssets: payload as unknown as Prisma.InputJsonObject },
      })
    );
  } catch (err) {
    console.error(
      `[generateAiAssets] failed to persist failure for product=${productId}:`,
      err
    );
  }
}
