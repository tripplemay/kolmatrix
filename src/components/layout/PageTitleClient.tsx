"use client";

/**
 * BIx-mvp-polish-pass F005-F · Page-title client island.
 *
 * The Topbar's left-side title used to be computed inside
 * AppShellLayout (client) using `usePathname()`. Pulling the
 * pathname read into this leaf component lets AppShellLayout +
 * Topbar regress to server components, and only this ~30-line shim
 * lands on the client bundle.
 */
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { deriveActiveNav, NAV_ITEMS } from "./nav-config";

export function PageTitleClient() {
  // BL-070-F003 — fallback path flipped to /insight per the new
  // canonical landing surface (dashboard content lives in tab=dashboard).
  const pathname = usePathname() ?? "/insight";
  const t = useTranslations("nav");
  const activeId = deriveActiveNav(pathname);
  const activeItem = NAV_ITEMS.find((n) => n.id === activeId);
  const title = activeItem ? t(activeItem.i18nKey.replace(/^nav\./, "")) : "";
  return (
    <h1
      data-testid="topbar-page-title"
      className="text-on-surface shrink-0 text-[16px] font-semibold"
    >
      {title}
    </h1>
  );
}
