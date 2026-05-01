/**
 * BM2-F006 · Resend client with mock fallback.
 *
 * When `RESEND_API_KEY` is set, delegates to the official `resend`
 * SDK. When unset (local dev without credentials), emits a structured
 * `[EMAIL MOCK]` log line and returns a synthetic success so the
 * upstream EmailLog path can record `status='mock_sent'` instead of
 * silently failing.
 *
 * Retry + timeout: Resend's SDK handles its own HTTP concerns; we
 * wrap an abort controller for the 30s deadline and do one cold
 * retry on the caller's behalf when the SDK throws a transient
 * error (network / 5xx / rate_limit).
 */
import "dotenv/config";

import { Resend } from "resend";

export const FROM_ADDRESS = "marketer@kolquest.com"; // ADR-010

export interface SendEmailInput {
  to: string;
  subject: string;
  /** Plain-text body; the Resend SDK renders text+html automatically
   *  when only `text` is provided. */
  bodyText: string;
  /** Optional HTML body; overrides the text → html auto-render. */
  bodyHtml?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  providerMessageId: string | null;
  mocked: boolean;
}

export class SendEmailError extends Error {
  constructor(
    public readonly code: "invalid_to" | "timeout" | "rate_limited" | "provider_error" | "unknown",
    message: string
  ) {
    super(message);
    this.name = "SendEmailError";
  }
}

function isMockMode(): boolean {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // BIx-mvp-polish-pass F002 (P1-9) — fail fast in production rather
    // than silently mock. Real customer outreach must never silently
    // disappear into a [EMAIL MOCK] log line. Local dev still
    // tolerates the missing key (developers don't always have one).
    if (process.env.NODE_ENV === "production") {
      throw new SendEmailError(
        "provider_error",
        "RESEND_API_KEY missing in production — email send refused; see ADR-010"
      );
    }
    return true;
  }
  // Common placeholder values should behave like no-key dev setups,
  // and likewise refuse to ship in production.
  if (/^(placeholder|test|mock|re_placeholder)/i.test(key)) {
    if (process.env.NODE_ENV === "production") {
      throw new SendEmailError(
        "provider_error",
        "RESEND_API_KEY looks like a placeholder in production — refusing to send"
      );
    }
    return true;
  }
  return false;
}

let cachedClient: Resend | null = null;
function getClient(): Resend {
  if (cachedClient) return cachedClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new SendEmailError("unknown", "RESEND_API_KEY not set");
  }
  cachedClient = new Resend(key);
  return cachedClient;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        t = setTimeout(() => reject(new SendEmailError("timeout", "resend timed out")), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!/^.+@.+\..+$/.test(input.to)) {
    throw new SendEmailError("invalid_to", `invalid email: ${input.to}`);
  }

  if (isMockMode()) {
    // Structured log so marketers running local dev can see the
    // payload without chasing a debugger. Keep the prefix stable
    // for log-scrapers.
    console.log("[EMAIL MOCK]", {
      from: FROM_ADDRESS,
      to: input.to,
      subject: input.subject,
      preview: input.bodyText.slice(0, 120),
    });
    return { providerMessageId: null, mocked: true };
  }

  const client = getClient();

  const doSend = () =>
    client.emails.send({
      from: FROM_ADDRESS,
      to: input.to,
      subject: input.subject,
      text: input.bodyText,
      ...(input.bodyHtml ? { html: input.bodyHtml } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });

  const runWithRetry = async (): Promise<SendEmailResult> => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { data, error } = await withTimeout(doSend(), 30_000);
        if (error) {
          const name = error.name ?? "";
          // Resend SDK error shapes: `rate_limit_exceeded` / `validation_error` / etc.
          const retryable = /rate_limit|internal_server|timeout|network/i.test(name);
          if (!retryable || attempt === 1) {
            throw new SendEmailError(
              name === "rate_limit_exceeded" ? "rate_limited" : "provider_error",
              `resend error: ${name} ${error.message}`
            );
          }
          // else fall through to retry
          continue;
        }
        return {
          providerMessageId: data?.id ?? null,
          mocked: false,
        };
      } catch (err) {
        if (err instanceof SendEmailError) {
          if (err.code === "timeout" && attempt === 0) continue;
          throw err;
        }
        if (attempt === 1) {
          throw new SendEmailError("unknown", `resend send failed: ${(err as Error).message}`);
        }
      }
    }
    throw new SendEmailError("unknown", "resend retries exhausted");
  };

  return runWithRetry();
}
