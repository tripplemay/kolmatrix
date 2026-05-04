"use client";

import { useEffect } from "react";

interface Props {
  cookieName: string;
}

/**
 * BL-020-F003 (CR-3) — replaces the previous inline-script IIFE in
 * FilterSidebar.tsx with a tiny `useEffect`-driven listener. Behaviour
 * is identical: write `${cookieName}=1` or `=0` whenever the marketer
 * expands or collapses the advanced filter `<details>`. The cookie persists
 * the user's preference across Discovery visits without React state
 * touching the form values themselves.
 *
 * Lives next to FilterSidebar (a server component) so the surrounding
 * server-only render can stay async; React handles the hydration island.
 */
export function AdvancedToggleCookie({ cookieName }: Props) {
  useEffect(() => {
    const el = document.querySelector<HTMLDetailsElement>(
      "details[data-disco-advanced]"
    );
    if (!el) return;
    const onToggle = () => {
      document.cookie = `${cookieName}=${el.open ? "1" : "0"};path=/;max-age=31536000;samesite=lax`;
    };
    el.addEventListener("toggle", onToggle);
    return () => {
      el.removeEventListener("toggle", onToggle);
    };
  }, [cookieName]);
  return null;
}
