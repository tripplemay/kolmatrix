/**
 * MVP-vf-F006 · Tab navigation for /kols/:id.
 *
 * URL-driven (`?tab=collabs|contacts|ai`); the parent page parses the
 * search-param and feeds the active key in. Uses links rather than
 * client buttons so the active tab is reflected in browser history /
 * is share-friendly.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type KolTabKey = "overview" | "collabs" | "contacts" | "ai";

const TABS: KolTabKey[] = ["overview", "collabs", "contacts", "ai"];

interface Props {
  basePath: string;
  active: KolTabKey;
}

export async function KolTabsNav({ basePath, active }: Props) {
  const t = await getTranslations("kolProfile.tabs");
  return (
    <nav
      role="tablist"
      aria-label="KOL profile tabs"
      className="flex gap-1 border-b border-white/5"
    >
      {TABS.map((key) => {
        const isActive = key === active;
        const href = key === "overview" ? basePath : `${basePath}?tab=${key}`;
        return (
          <Link
            key={key}
            href={href}
            role="tab"
            aria-selected={isActive}
            data-testid={`kol-tab-${key}`}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-cyan text-cyan"
                : "border-transparent text-on-surface-variant hover:text-cyan/80"
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
