"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface TopbarSearchProps {
  placeholder?: string;
  className?: string;
}

export function TopbarSearch({ placeholder, className }: TopbarSearchProps) {
  const t = useTranslations("topbar");
  const effectivePlaceholder = placeholder ?? t("searchPlaceholder");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <label
      className={cn(
        "bg-navy-700 focus-within:ring-brand-500 group flex h-10 w-full items-center gap-2.5 rounded-full px-4 transition-shadow focus-within:shadow-[0_0_0_4px_rgba(66,42,251,0.22)] focus-within:ring-1",
        className
      )}
    >
      <span
        className="material-symbols-outlined text-on-surface-variant/80 text-[18px]"
        aria-hidden
      >
        search
      </span>
      <input
        ref={inputRef}
        type="search"
        placeholder={effectivePlaceholder}
        className="text-on-surface placeholder:text-on-surface-variant/60 flex-1 bg-transparent text-[13px] outline-none"
      />
      <kbd className="text-on-surface-variant/70 bg-surface-bright/60 rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wider">
        ⌘K
      </kbd>
    </label>
  );
}
