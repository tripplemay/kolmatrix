import { defineRouting } from "next-intl/routing";

// BM1-F008: keep the cookie name reachable as a plain string constant
// so the middleware can read it without fighting next-intl's
// boolean-or-options type union.
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export const routing = defineRouting({
  locales: ["en", "zh", "ja", "ko", "es"] as const,
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: true,
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (routing.locales as readonly string[]).includes(value);
}
