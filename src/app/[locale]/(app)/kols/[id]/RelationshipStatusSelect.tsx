"use client";

/**
 * BM1-F006 · Relationship-status dropdown island.
 *
 * A plain <select> wired through useActionState so the pending state
 * flips immediately while the server revalidates the page. The select
 * is auto-submitted on change via formRef.requestSubmit(); no extra
 * "Save" button needed because there's only one field here.
 */
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";

import { RELATIONSHIP_STATUSES, type RelationshipStatus } from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

import {
  updateKolRelationshipStatus,
  type UpdateRelationshipStatusState,
} from "./actions";

const initial: UpdateRelationshipStatusState = { ok: false };

interface Props {
  kolId: string;
  currentStatus: RelationshipStatus;
}

export function RelationshipStatusSelect({ kolId, currentStatus }: Props) {
  const t = useTranslations("kolProfile.overview");
  const tStatus = useTranslations("relationshipStatus");
  const tErr = useTranslations("kolProfile.errors");
  const [state, formAction, pending] = useActionState(
    updateKolRelationshipStatus,
    initial
  );
  const formRef = useRef<HTMLFormElement>(null);
  const displayStatus: RelationshipStatus =
    state.ok && state.status ? state.status : currentStatus;

  useEffect(() => {
    if (state.error) {
      // surface the error once; no retry-loop logic needed because the
      // dropdown stays on the server-confirmed value.
    }
  }, [state.error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-2"
      data-testid="kol-status-form"
    >
      <input type="hidden" name="kolId" value={kolId} />
      <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {t("status")}
      </label>
      <select
        name="status"
        defaultValue={displayStatus}
        onChange={() => formRef.current?.requestSubmit()}
        disabled={pending}
        data-testid="kol-status-select"
        className={cn(
          "h-10 rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan",
          pending && "opacity-60"
        )}
      >
        {RELATIONSHIP_STATUSES.map((s) => (
          <option key={s} value={s}>
            {tStatus(s)}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-on-surface-variant/70">
        {t("statusHelper")}
      </p>
      {state.error ? (
        <p className="text-[11px] text-rose-400" role="alert">
          {tErr(state.error)}
        </p>
      ) : null}
    </form>
  );
}
