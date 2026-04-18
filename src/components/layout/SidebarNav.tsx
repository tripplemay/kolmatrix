"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

import { NAV_ITEMS, type NavItemId } from "./nav-config";

interface SidebarNavProps {
  activeId: NavItemId;
}

export function SidebarNav({ activeId }: SidebarNavProps) {
  return (
    <nav aria-label="Primary" className="flex-1 px-3">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id} className="relative">
              {isActive ? (
                <span
                  aria-hidden
                  className="bg-cyan absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-r-full"
                />
              ) : null}
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[14px] font-medium transition-colors duration-200",
                  isActive
                    ? "text-cyan from-cyan/12 to-cyan/0 bg-gradient-to-r font-semibold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-high/50"
                )}
              >
                <span
                  className={cn("material-symbols-outlined text-[20px]", isActive ? "ai-glow" : "")}
                  aria-hidden
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
