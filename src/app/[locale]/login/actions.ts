"use server";

import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";

import { signIn } from "@/auth";
import { isLocale, routing } from "@/i18n/routing";

export type LoginState = {
  error?: string;
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "missing_fields" };
  }

  // BM1-F009 fix: redirect to a locale-prefixed path so the post-login
  // Server Action RSC navigation lands on the final URL directly. If we
  // redirect to the bare `/dashboard`, middleware 307s it to
  // `/en/dashboard` on the server, but Next keeps the browser URL at the
  // Server Action's original redirectTo (`/dashboard`) while the
  // rendered RSC payload is for `/en/dashboard`. That URL-vs-content
  // mismatch breaks subsequent client-side navigation — the sidebar
  // link click sees the router's state for `/dashboard` and hangs
  // resolving the transition on staging (Reviewer 2026-04-23 report).
  const currentLocale = await getLocale().catch(() => undefined);
  const locale = isLocale(currentLocale) ? currentLocale : routing.defaultLocale;

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: `/${locale}/dashboard`,
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
