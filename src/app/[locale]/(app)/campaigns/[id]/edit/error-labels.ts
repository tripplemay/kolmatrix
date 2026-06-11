/**
 * BL-105-F001/F002 · Shared edit-surface error labels.
 *
 * Lives outside page.tsx because Next App Router page files may only
 * export the default component + route segment config — a named helper
 * export there fails `next build` (BL-105-F001 CI: "Build + migrate
 * smoke"). All three edit controls (field form / status / revenue) map
 * the same action error codes, so they share this assembler.
 */
import type { getTranslations } from "next-intl/server";

type TFn = Awaited<ReturnType<typeof getTranslations>>;

export function editErrorLabels(t: TFn): Record<string, string> {
  return {
    unauthorized: t("errors.unauthorized"),
    invalid_input: t("errors.invalid_input"),
    validation_failed: t("errors.validation_failed"),
    endBeforeStart: t("errors.endBeforeStart"),
    budgetInvalid: t("errors.budgetInvalid"),
    revenueInvalid: t("errors.revenueInvalid"),
    not_found: t("errors.not_found"),
    invalid_transition: t("errors.invalid_transition"),
    forbidden_when_completed: t("errors.forbidden_when_completed"),
    db_error: t("errors.db_error"),
    generic: t("errors.generic"),
  };
}
