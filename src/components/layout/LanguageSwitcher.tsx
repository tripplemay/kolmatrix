"use client";

import { cn } from "@/lib/utils";

type Locale = "en" | "zh" | "ja" | "ko" | "es";

interface LanguageSwitcherProps {
  currentLocale?: Locale;
}

export function LanguageSwitcher({ currentLocale = "en" }: LanguageSwitcherProps) {
  const label = currentLocale.toUpperCase();
  return (
    <button
      type="button"
      aria-label="Change language"
      className={cn(
        "hover:text-cyan hover:bg-surface-high/60 text-on-surface-variant inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold tracking-wide transition-colors"
      )}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden>
        language
      </span>
      {label}
    </button>
  );
}
