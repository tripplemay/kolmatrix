import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh", "ja", "ko", "es"] as const,
  defaultLocale: "en",
  localePrefix: "always",
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (routing.locales as readonly string[]).includes(value);
}
