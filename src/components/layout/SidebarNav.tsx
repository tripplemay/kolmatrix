"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { NAV_ITEMS, type NavItemId } from "./nav-config";

interface SidebarNavProps {
  activeId: NavItemId;
}

export function SidebarNav({ activeId }: SidebarNavProps) {
  const locale = useLocale();
  const t = useTranslations("nav");
  return (
    <nav aria-label="Primary" className="mt-8 flex-1">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeId;
          const key = item.i18nKey.replace(/^nav\./, "");
          return (
            <li key={item.id}>
              <Link
                href={`/${locale}${item.href}`}
                aria-current={isActive ? "page" : undefined}
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
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
