"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface UserAvatarMenuProps {
  user: { name: string; email?: string | null; avatarUrl?: string | null };
  onSignOut?: () => void;
}

export function UserAvatarMenu({ user, onSignOut }: UserAvatarMenuProps) {
  const t = useTranslations("userMenu");
  const [open, setOpen] = useState(false);
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

  const initial = user.name.trim().charAt(0).toUpperCase() || "U";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-surface-high/60 inline-flex items-center gap-1.5 rounded-full p-1 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="bg-surface-high relative h-8 w-8 overflow-hidden rounded-full">
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt="" fill sizes="32px" className="object-cover" />
          ) : (
            <div className="gradient-cta flex h-full w-full items-center justify-center">
              <span className="text-navy-base text-[13px] font-bold">{initial}</span>
            </div>
          )}
        </div>
        <span
          className="material-symbols-outlined text-on-surface-variant/80 text-[18px]"
          aria-hidden
        >
          expand_more
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "bg-surface-low ring-cyan/15 ambient-glow absolute right-0 z-[60] mt-2 w-56 overflow-hidden rounded-[14px] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)] ring-1"
          )}
        >
          <div className="px-3 py-2">
            <p className="text-on-surface truncate text-[13px] font-semibold">{user.name}</p>
            {user.email ? (
              <p className="text-on-surface-variant/70 truncate text-[11px]">{user.email}</p>
            ) : null}
          </div>
          <div className="bg-outline-variant/40 mx-2 my-1 h-px" />
          <MenuItem icon="person">{t("profile")}</MenuItem>
          <MenuItem icon="settings">{t("settings")}</MenuItem>
          <div className="bg-outline-variant/40 mx-2 my-1 h-px" />
          {onSignOut ? (
            <form action={onSignOut}>
              <button
                type="submit"
                role="menuitem"
                className="text-on-surface-variant hover:text-cyan hover:bg-surface-high/60 flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  logout
                </span>
                {t("signOut")}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="text-on-surface-variant hover:text-cyan hover:bg-surface-high/60 flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors"
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden>
        {icon}
      </span>
      {children}
    </button>
  );
}
