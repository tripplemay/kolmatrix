"use client";

/**
 * BM2-F005 + MVP-vf-F005 · Add-KOL dialog for /campaigns/:id.
 *
 * Replaces the 495-line bespoke modal that lived inside
 * CampaignKolPanel.tsx with a thin layer over the public `<Dialog>`
 * atom. Same behaviour: list of saved-but-not-yet-linked KOLs, search
 * filter, optional kolFee prefill, server-action submission. The
 * useFormStatus + useActionState wiring is unchanged.
 */
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
  Input,
} from "@/components/ui";

import { addKolAction, type ActionState } from "./actions";

export interface AvailableKol {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
  followerCount: number;
}

interface Labels {
  title: string;
  searchPlaceholder: string;
  empty: string;
  feeLabel: string;
  submit: string;
  close: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  available: AvailableKol[];
  labels: Labels;
  errorLabels: Record<string, string>;
}

function avatarInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function AddKolDialog({
  open,
  onOpenChange,
  campaignId,
  available,
  labels,
  errorLabels,
}: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(
    available[0]?.id ?? null
  );
  const [state, formAction] = useActionState<ActionState, FormData>(addKolAction, {
    ok: false,
  });
  const lastResultRef = useRef<boolean>(false);

  useEffect(() => {
    if (state.ok && !lastResultRef.current) {
      lastResultRef.current = true;
      onOpenChange(false);
    }
  }, [state.ok, onOpenChange]);

  const filtered = available.filter((k) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      k.displayName.toLowerCase().includes(q) ||
      k.handle.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPanel
          data-testid="campaign-kol-add-dialog"
          className="max-h-[80vh] w-full max-w-xl"
        >
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
          </DialogHeader>

          <div className="mt-3">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder={labels.searchPlaceholder}
              data-testid="campaign-kol-add-search"
            />
          </div>

          <div className="mt-3 max-h-[40vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">
                {labels.empty}
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {filtered.map((k) => (
                  <li key={k.id}>
                    <label className="flex cursor-pointer items-center gap-3 py-3">
                      <input
                        type="radio"
                        name="kolId-picker"
                        value={k.id}
                        checked={selected === k.id}
                        onChange={() => setSelected(k.id)}
                        className="h-4 w-4 accent-cyan"
                      />
                      <span
                        aria-hidden
                        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary"
                      >
                        {k.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={k.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          avatarInitials(k.displayName)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {k.displayName}
                        </span>
                        <span className="block truncate text-xs text-on-surface-variant">
                          @{k.handle} · {k.platform} · {formatFollowers(k.followerCount)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form
            action={formAction}
            className="mt-4 space-y-3"
            data-testid="campaign-kol-add-form"
          >
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="kolId" value={selected ?? ""} />
            <label className="flex items-center gap-3 text-xs font-medium text-on-surface-variant">
              <span>{labels.feeLabel}</span>
              <Input
                type="text"
                inputMode="decimal"
                name="kolFee"
                placeholder="0.00"
                data-testid="campaign-kol-add-fee"
                className="h-9 w-32"
              />
            </label>

            {state.error ? (
              <p className="text-xs text-error" data-testid="campaign-kol-add-error">
                {errorLabels[state.error] ?? errorLabels.generic}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                {labels.close}
              </Button>
              <AddSubmit submitLabel={labels.submit} disabled={selected == null} />
            </DialogFooter>
          </form>
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}

function AddSubmit({
  submitLabel,
  disabled,
}: {
  submitLabel: string;
  disabled: boolean;
}) {
  const status = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary-gradient"
      disabled={status.pending || disabled}
      data-testid="campaign-kol-add-submit"
    >
      {status.pending ? `${submitLabel}…` : submitLabel}
    </Button>
  );
}
