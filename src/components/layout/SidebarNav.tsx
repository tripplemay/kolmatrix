"use client";

/**
 * BIx-mvp-polish-pass F005-F · The other half of the AppShellLayout
 * → server-component refactor. SidebarNav now derives `activeId`
 * itself via `usePathname()` instead of receiving it as a prop, so
 * the parent shell can stay server-rendered.
 */
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { deriveActiveNav, NAV_ITEMS } from "./nav-config";

export function SidebarNav() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const pathname = usePathname() ?? "/dashboard";
  const activeId = deriveActiveNav(pathname);
  return (
    <nav aria-label="Primary" className="mt-8 flex-1">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeId;
          const labelKey = item.i18nKey.replace(/^nav\./, "");
          const descKey = item.descriptionKey.replace(/^nav\./, "");
          const description = t(descKey);
          return (
            <li key={item.id}>
              <Link
                href={`/${locale}${item.href}`}
                aria-current={isActive ? "page" : undefined}
                title={description}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 text-[14px] font-medium transition-colors duration-200",
                  isActive
                    ? "text-cyan border-cyan from-cyan/10 rounded-none border-l-2 bg-gradient-to-r to-transparent font-semibold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-high/50 rounded-[10px]"
                )}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden>
                  {item.icon}
                </span>
                <span>{t(labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
