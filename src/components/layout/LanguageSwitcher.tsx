"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { updateUserLocale } from "@/app/[locale]/(app)/actions";
import { cn } from "@/lib/utils";

type Locale = "en" | "zh" | "ja" | "ko" | "es";
const LOCALES: Locale[] = ["en", "zh", "ja", "ko", "es"];

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("topbar");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const change = async (next: Locale) => {
    if (next === locale) return;
    const segments = pathname.split("/").filter(Boolean);
    if (LOCALES.includes(segments[0] as Locale)) segments[0] = next;
    else segments.unshift(next);
    const newPath = "/" + segments.join("/");

    setOpen(false);
    setIsPending(true);
    try {
      await updateUserLocale(next);
    } catch (err) {
      console.error("Failed to persist locale", err);
    }
    router.push(newPath);
    setIsPending(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          "hover:text-cyan hover:bg-surface-high/60 text-on-surface-variant inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold tracking-wide transition-colors",
          isPending && "opacity-60"
        )}
        aria-label={t("languageAriaLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden>
          language
        </span>
        {locale.toUpperCase()}
        <span className="material-symbols-outlined text-[14px]" aria-hidden>
          expand_more
        </span>
      </button>
      {open ? (
        <ul
          role="menu"
          className="bg-surface-low ring-cyan/15 absolute right-0 z-[60] mt-2 w-44 overflow-hidden rounded-[12px] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)] ring-1"
        >
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                role="menuitem"
                disabled={l === locale || isPending}
                onClick={() => change(l)}
                className={cn(
                  "block w-full rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors",
                  l === locale
                    ? "bg-cyan/10 text-cyan font-semibold"
                    : "text-on-surface hover:bg-surface-high/60 hover:text-cyan"
                )}
              >
                {t(`locale.${l}`)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
