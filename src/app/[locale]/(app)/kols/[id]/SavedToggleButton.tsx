"use client";

/**
 * BM1-F006 · Profile-page save toggle.
 *
 * Reuses `toggleKolSaved` from /discovery — same server action, same
 * event_log contract. The profile variant uses a fuller button style
 * (with helper copy) instead of the compact card chip.
 */
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { toggleKolSaved, type ToggleKolSavedState } from "../../discovery/actions";
import { cn } from "@/lib/utils";

const initial: ToggleKolSavedState = { ok: false };

interface Props {
  kolId: string;
  currentSaved: boolean;
}

export function SavedToggleButton({ kolId, currentSaved }: Props) {
  const t = useTranslations("kolProfile.overview");
  const [state, formAction, pending] = useActionState(toggleKolSaved, initial);
  const saved = state.ok && state.kolId === kolId ? state.saved! : currentSaved;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="kolId" value={kolId} />
      <input type="hidden" name="nextSaved" value={saved ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={saved}
        data-testid="kol-save-toggle"
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors",
          saved
            ? "border-cyan/40 bg-cyan/15 text-cyan"
            : "border-outline-variant text-on-surface-variant hover:border-cyan/40 hover:text-cyan",
          pending && "opacity-60"
        )}
      >
        <span
          className="material-symbols-outlined text-[18px]"
          aria-hidden
          style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {saved ? "bookmark_added" : "bookmark"}
        </span>
        {saved ? t("saved") : t("save")}
      </button>
      <p className="text-[11px] text-on-surface-variant/70">{t("saveHelper")}</p>
    </form>
  );
}
