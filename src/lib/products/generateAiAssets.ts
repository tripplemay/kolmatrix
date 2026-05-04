/**
 * BM1-F003 (rewritten by BL-030-F001) · Product AI asset generator.
 *
 * Calls the aigcgateway /v1/chat/completions endpoint (OpenAI-compatible)
 * to produce 3 email templates + 2 video scripts for KOL outreach.
 *
 * BL-030 migration (2026-05-04, ADR-011 follow-through): the generated
 * content is now persisted as 5 rows in the unified `Asset` table
 * (source=ai_generated, status=published) so /assets and /outreach
 * composer surface them through the same readers as the Wizard path.
 * `Product.aiAssets` shrinks to a status tracker
 * ({status, generatedAt|requestedAt|failedAt|error}) — the JSON content
 * fields (emailTemplates / videoScripts) are no longer written here.
 *
 * Naming + role mapping is locked in spec §3.1 and must stay aligned with
 * the AI prompt order below: emails [initial outreach / follow-up /
 * signing invitation], videos [YouTube 60s / TikTok 15s].
 */
import { Prisma, withTenant } from "@/lib/db";
import { resolveAigcV1BaseUrl } from "@/lib/aigc/base-url";
import { createAsset } from "@/lib/assets/mutations";
import { logAudit } from "@/lib/audit/log";
import type { AssetDetail } from "@/lib/assets/types";

export interface GenerateAiAssetsInput {
  productId: string;
  tenantId: string;
  /**
   * BL-030-F001 — userId of the actor that triggered the generation.
   * Required so each Asset row's createdBy + the asset.generated audit
   * entry attribute the action correctly. Caller (knowledge-base
   * actions.ts) supplies session.user.id; KB actions reject the call
   * earlier when the session has no userId.
   */
  actorUserId: string;
  name: string;
  category: string;
  targetAudience: string | null;
  uniqueSellingPoints: string;
  downloadUrl: string | null;
}

/**
 * BL-030-F001 — `Product.aiAssets` JSON shrinks to a status tracker.
 * The previous `ProductAiAssetContent` intersection (carrying
 * emailTemplates / videoScripts inline) is removed; that content lives
 * in the Asset table now. The legacy field is kept on the Product row
 * because (a) we still need pending / ready / failed for the KB
 * spinner UX, and (b) avoiding a schema migration keeps rollback to a
 * `git revert`.
 */
export type ProductAiAssets =
  | {
      status: "pending";
      requestedAt: string;
    }
  | {
      status: "ready";
      generatedAt: string;
    }
  | {
      status: "failed";
      error: string;
      failedAt: string;
    };

const DEFAULT_MODEL = "claude-haiku-4.5";

// BL-030-F001 §3.1 — ordered roles + name suffixes locked to the
// prompt-imposed generation order. Index lookup is the single source
// of truth for both the live generator (here) and the backfill script
// (scripts/migrate-product-aiassets-to-asset.ts).
const EMAIL_TEMPLATE_ROLES = ["initial_outreach", "follow_up", "signing_invitation"] as const;
const EMAIL_NAME_SUFFIXES = ["Initial outreach", "Follow-up", "Signing invitation"] as const;
const VIDEO_TEMPLATE_ROLES = ["youtube_60s", "tiktok_15s"] as const;
const VIDEO_NAME_SUFFIXES = ["YouTube 60s", "TikTok 15s"] as const;

export type EmailTemplateRole = (typeof EMAIL_TEMPLATE_ROLES)[number];
export type VideoTemplateRole = (typeof VIDEO_TEMPLATE_ROLES)[number];

/** Internal — what parseAndValidate returns from the aigcgateway response. */
interface ParsedAiAssetContent {
  emailTemplates: Array<{ subject: string; body: string }>;
  videoScripts: Array<{ title: string; script: string }>;
}

/**
 * BL-033-F003 (v0.9.9 §3) — server-side guardrail for the AI placeholder
 * contract. Thrown when AI output contains bracket placeholders like
 * `[Creator Name]` but no Mustache tokens, signalling the prompt
 * regressed and the substitution layer would render the bracket text
 * literally to recipients. Falls into the existing catch path so
 * Product.aiAssets becomes `failed` and no Asset rows persist.
 */
export class AiPlaceholderViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiPlaceholderViolationError";
  }
}

// Spec §D3 — only flag uppercase-led bracket strings. Lower/Title-case
// brackets like [press release] are legitimate marketing prose.
// Match a single capital then any letters or spaces, so multi-word
// variants ([Creator Name], [Your Name], [DATE]) all hit.
const BRACKET_RE = /\[[A-Z][a-zA-Z ]+\]/g;
// Mustache tokens are always lowercase (per the prompt + seed catalogue:
// {{kol.name}}, {{product.usp}}, {{marketer.name}}, {{date}}).
const MUSTACHE_RE = /\{\{[a-z][a-zA-Z0-9_.]+\}\}/g;

function validateNoBracketPlaceholders(parsed: ParsedAiAssetContent): void {
  const segments: string[] = [];
  for (const e of parsed.emailTemplates) {
    segments.push(e.subject, e.body);
  }
  for (const v of parsed.videoScripts) {
    segments.push(v.title, v.script);
  }
  for (const text of segments) {
    const brackets = text.match(BRACKET_RE) ?? [];
    const mustaches = text.match(MUSTACHE_RE) ?? [];
    if (brackets.length > 0 && mustaches.length === 0) {
      throw new AiPlaceholderViolationError(
        `AI output uses bracket placeholders (${brackets.slice(0, 3).join(", ")}) but no Mustache tokens — prompt regression`
      );
    }
  }
}

export function deriveEmailAssetName(productName: string, index: number): string {
  const suffix = EMAIL_NAME_SUFFIXES[index] ?? `Variant ${index + 1}`;
  return `${productName} — ${suffix}`;
}

export function deriveVideoAssetName(productName: string, index: number): string {
  const suffix = VIDEO_NAME_SUFFIXES[index] ?? `Variant ${index + 1}`;
  return `${productName} — ${suffix}`;
}

export function emailTemplateRoleAt(index: number): EmailTemplateRole {
  return EMAIL_TEMPLATE_ROLES[index] ?? "initial_outreach";
}

export function videoTemplateRoleAt(index: number): VideoTemplateRole {
  return VIDEO_TEMPLATE_ROLES[index] ?? "youtube_60s";
}

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
    `\nReturn strict JSON: { "emailTemplates": [{"subject": "...", "body": "..."}], "videoScripts": [{"title": "...", "script": "..."}] }.\n` +
    // BL-032-F001 §D1 — substitution layer only recognizes Mustache; constrain the AI explicitly.
    `\nUse these EXACT Mustache tokens in subject/body where personalization is needed; do not use square brackets like [Creator Name] or [Your Name] (the system substitution layer only recognizes Mustache):\n` +
    `- {{kol.name}} for the creator/KOL recipient name\n` +
    `- {{product.name}} for the product/game name\n` +
    `- {{product.category}} for the product category  \n` +
    `- {{product.usp}} for the product unique selling points\n` +
    `- {{marketer.name}} for the sender/marketer signature\n` +
    `- {{date}} for the current date (formatted as yyyy-mm-dd, e.g. 2026-05-04)\n` +
    `\nExample: "Hi {{kol.name}}, ..." / "—{{marketer.name}}".`;

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

  let createdAssets: AssetDetail[] = [];
  try {
    const resp = await fetchImpl(`${resolveAigcV1BaseUrl(baseUrl)}/chat/completions`, {
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
    // BL-033-F003 — server-side guardrail. Bracket-only output throws
    // AiPlaceholderViolationError, falling into the catch path below so
    // Product.aiAssets becomes failed and no Asset rows persist.
    validateNoBracketPlaceholders(parsed);
    const generatedAt = new Date().toISOString();
    const traceId = json.id ?? null;

    // Cap to the 3 email + 2 video roles defined in the prompt. If
    // aigcgateway returns more (rare), the extras are dropped — the
    // role table only names the first 3/2.
    const emails = parsed.emailTemplates.slice(0, EMAIL_TEMPLATE_ROLES.length);
    const videos = parsed.videoScripts.slice(0, VIDEO_TEMPLATE_ROLES.length);

    // BL-030-F001 — Asset writes + Product.aiAssets shrink in one tx
    // so a failure mid-loop rolls back both. logAudit runs after the
    // tx commits (matches assets/actions.ts:281 — audit must not hold
    // the row lock open across additional writes).
    createdAssets = await withTenant(input.tenantId, async (tx) => {
      const created: AssetDetail[] = [];

      for (let i = 0; i < emails.length; i += 1) {
        const email = emails[i]!;
        const detail = await createAsset(tx, input.tenantId, {
          type: "email",
          name: deriveEmailAssetName(input.name, i),
          // EmailContentSchema requires locale + variables; the
          // aigcgateway prompt is hardcoded English so locale="en"
          // is correct. Empty variables array is the schema default.
          content: {
            subject: email.subject,
            body: email.body,
            locale: "en",
            variables: [],
          },
          source: "ai_generated",
          status: "published",
          productId: input.productId,
          createdBy: input.actorUserId,
          metadata: {
            source: "kb_generation",
            productId: input.productId,
            templateRole: emailTemplateRoleAt(i),
            generatedAt,
            traceId,
          },
        });
        created.push(detail);
      }

      for (let i = 0; i < videos.length; i += 1) {
        const video = videos[i]!;
        const detail = await createAsset(tx, input.tenantId, {
          type: "video_script",
          name: deriveVideoAssetName(input.name, i),
          content: { title: video.title, script: video.script },
          source: "ai_generated",
          status: "published",
          productId: input.productId,
          createdBy: input.actorUserId,
          metadata: {
            source: "kb_generation",
            productId: input.productId,
            templateRole: videoTemplateRoleAt(i),
            generatedAt,
            traceId,
          },
        });
        created.push(detail);
      }

      // D3 — shrink Product.aiAssets to a status tracker (no content).
      const shrunk: ProductAiAssets = { status: "ready", generatedAt };
      await tx.product.update({
        where: { id: input.productId },
        data: { aiAssets: shrunk as unknown as Prisma.InputJsonObject },
      });

      return created;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[generateAiAssets] product=${input.productId} failed:`,
      err
    );
    await writeFailure(input.tenantId, input.productId, message);
    return;
  }

  // D5 — one audit row per Asset, mirroring assets/actions.ts shape so
  // admin tooling can slice "asset.generated" by both KB and Wizard
  // paths via after.source.
  for (const asset of createdAssets) {
    await logAudit({
      actorId: input.actorUserId,
      action: "asset.generated",
      targetType: "asset",
      targetId: asset.id,
      tenantId: input.tenantId,
      after: {
        assetId: asset.id,
        productId: input.productId,
        type: asset.type,
        source: "kb_generation",
      },
    });
  }
}

function parseAndValidate(raw: string): ParsedAiAssetContent {
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

// Internal helpers exposed for the backfill script + tests so the
// naming / role table stays single-source-of-truth.
export const __TEMPLATE_TABLE__ = {
  EMAIL_TEMPLATE_ROLES,
  EMAIL_NAME_SUFFIXES,
  VIDEO_TEMPLATE_ROLES,
  VIDEO_NAME_SUFFIXES,
} as const;
