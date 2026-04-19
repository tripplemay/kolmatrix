/**
 * Shared render helper for components that depend on next-intl context.
 * Loads the canonical `messages/en.json` bundle so assertions can match
 * the real translations without copy-paste.
 *
 * Usage:
 *   const { getByRole } = renderIntl(<SidebarNav activeId="dashboard" />);
 *
 * `locale` can be overridden per-test to exercise locale-specific paths
 * (e.g. LanguageSwitcher currently-selected highlight).
 */
import type { ReactElement } from "react";

import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import messages from "../../messages/en.json";

export function renderIntl(ui: ReactElement, locale: "en" | "zh" | "ja" | "ko" | "es" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages as never}>
      {ui}
    </NextIntlClientProvider>
  );
}
