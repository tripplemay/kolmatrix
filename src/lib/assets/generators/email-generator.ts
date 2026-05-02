/**
 * BL-025-F003 · Email asset content generator.
 *
 * Produces ONE email asset (subject + body + locale + variables)
 * — different from the legacy src/lib/products/generateAiAssets.ts
 * which batches 3 emails + 2 video scripts in a single call. The
 * Asset Library page lets the user generate / regenerate per asset
 * so each call is one variant; this gives the variant tree clean
 * parentId edges and the audit log a 1:1 trace per generation.
 *
 * Output is parsed dual-shape (object vs object-with-emailTemplates
 * wrapper, per ai-action-contract.md §1.3) so the action can be
 * pointed at either a plain JSON-mode chat completion or the future
 * `kol-email-customize` aigcgateway Action without rewriting the
 * parser.
 */
import { ZodError } from "zod";

import { type AssetContentByType, EmailContentSchema } from "../schemas";

import { runChatCompletion, type ChatCompletionResult } from "./aigcgateway-client";

export interface GenerateEmailContentInput {
  product: {
    name: string;
    category: string;
    targetAudience: string | null;
    uniqueSellingPoints: string;
  };
  steeringPrompt?: string;
  locale?: "en" | "zh" | "ja" | "ko" | "es";
  /** Pass-through to the chat client (test fetch stub). */
  fetchImpl?: typeof fetch;
}

export interface GenerateEmailContentResult {
  content: AssetContentByType["email"];
  usage: ChatCompletionResult["usage"];
  traceId: string | null;
  model: string;
}

export class EmailContentParseError extends Error {
  constructor(
    public readonly raw: string,
    public readonly cause: unknown
  ) {
    super("Failed to parse / validate AI email response");
    this.name = "EmailContentParseError";
  }
}

const SYSTEM_PROMPT =
  "You are a marketing copywriter for gaming KOL outreach. " +
  "Generate one promotional email that a creator would actually open. " +
  "Always respond with strict JSON. Keep the subject short (≤ 100 chars) " +
  "and the body conversational, under 1500 chars. Variables use double-curly " +
  "syntax like {{kol.name}}, {{product.name}}, {{marketer.name}}.";

function buildUserPrompt(input: GenerateEmailContentInput): string {
  const { product, steeringPrompt, locale } = input;
  const lines = [
    `Product name: ${product.name}`,
    `Category: ${product.category}`,
    `Target audience: ${product.targetAudience ?? "Not specified"}`,
    `Unique selling points: ${product.uniqueSellingPoints}`,
    locale ? `Locale: ${locale}` : null,
    steeringPrompt ? `Marketer steering: ${steeringPrompt}` : null,
    "",
    "Return strict JSON of the form:",
    '{ "subject": "...", "body": "...", "variables": [{"token":"{{kol.name}}","required":true}] }',
  ];
  return lines.filter((l) => l !== null).join("\n");
}

function parseEmailContent(
  raw: string
): AssetContentByType["email"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new EmailContentParseError(raw, err);
  }
  // Dual-shape tolerance — accept either a bare {subject, body} object
  // or an envelope {emailTemplates:[{subject,body}]} (legacy
  // generateAiAssets.ts shape so we can wire it through if the
  // gateway echos that shape from a future Action).
  let candidate: unknown = parsed;
  if (
    parsed != null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Array.isArray((parsed as { emailTemplates?: unknown }).emailTemplates)
  ) {
    candidate =
      (parsed as { emailTemplates: unknown[] }).emailTemplates[0] ?? null;
  }
  if (candidate == null || typeof candidate !== "object") {
    throw new EmailContentParseError(raw, new Error("not a JSON object"));
  }

  // Ensure required fields default to schema defaults if absent.
  const obj = candidate as Record<string, unknown>;
  const enriched = {
    subject: obj.subject,
    body: obj.body,
    locale: typeof obj.locale === "string" ? obj.locale : "en",
    variables: Array.isArray(obj.variables) ? obj.variables : [],
  };

  try {
    return EmailContentSchema.parse(enriched);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new EmailContentParseError(raw, err);
    }
    throw err;
  }
}

export async function generateEmailContent(
  input: GenerateEmailContentInput
): Promise<GenerateEmailContentResult> {
  const completion = await runChatCompletion({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
    temperature: 0.7,
    jsonMode: true,
    fetchImpl: input.fetchImpl,
  });

  const content = parseEmailContent(completion.rawContent);
  // Force the requested locale into the validated content (the prompt
  // already asks for it but model output occasionally drops it).
  if (input.locale) {
    content.locale = input.locale;
  }

  return {
    content,
    usage: completion.usage,
    traceId: completion.traceId,
    model: completion.model,
  };
}

export const __TEST_ONLY__ = {
  buildUserPrompt,
  parseEmailContent,
  SYSTEM_PROMPT,
} satisfies Record<string, unknown>;
