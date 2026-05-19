"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";

import { signIn } from "@/auth";
import { isLocale, routing } from "@/i18n/routing";
import { rateLimitLogin } from "@/lib/rate-limit";

export type LoginState = {
  error?: string;
  retryAfter?: number;
};

async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "missing_fields" };
  }

  // BL-035-F001 (AUTH-H2): enforce minimum password length at the
  // server boundary. Mirrors the auth.ts credentialsSchema check so
  // the LoginForm can surface a precise i18n error instead of the
  // generic "Invalid email or password".
  if (password.length < 12) {
    return { error: "password_too_short" };
  }

  // BL-020-F005 (H-S2): rate-limit BEFORE bcrypt — locking out at the
  // credential check would still let an attacker pin CPU on the hash.
  const rl = await rateLimitLogin(await getClientIp());
  if (!rl.ok) {
    return { error: "rate_limited", retryAfter: rl.retryAfter };
  }

  // BM1-F009 fix: redirect to a locale-prefixed path so the post-login
  // Server Action RSC navigation lands on the final URL directly. If we
  // redirect to the bare `/insight`, middleware 307s it to
  // `/en/insight` on the server, but Next keeps the browser URL at the
  // Server Action's original redirectTo (`/insight`) while the
  // rendered RSC payload is for `/en/insight`. That URL-vs-content
  // mismatch breaks subsequent client-side navigation — the sidebar
  // link click sees the router's state for `/insight` and hangs
  // resolving the transition on staging (Reviewer 2026-04-23 report).
  //
  // BL-070-F003 — landing surface flipped from /dashboard to /insight
  // (dashboard content lives in the default `?tab=dashboard` view).
  const currentLocale = await getLocale().catch(() => undefined);
  const locale = isLocale(currentLocale) ? currentLocale : routing.defaultLocale;

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: `/${locale}/insight`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "invalid_credentials" };
      }
      return { error: "generic" };
    }
    throw error;
  }

  return {};
}
