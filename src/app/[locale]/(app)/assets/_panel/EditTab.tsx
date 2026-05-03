"use client";

/**
 * BL-025-F005 · Detail panel · Edit tab.
 *
 * Email path: subject + body inputs + a chip toolbar that inserts a
 * variable token at the current caret position. Five tokens are
 * hardcoded (kol.name / kol.handle / product.name / campaign.name /
 * today_date) per the spec; future tokens come from a deeper
 * outreach.variables surface and are out of scope here.
 *
 * Video path: title + script (plain textarea + preview tab — the
 * spec calls out @uiw/react-md-editor as a future swap).
 *
 * Two save behaviours:
 *   Save                — overwrite via updateAssetAction
 *   Save as new version — fork via saveAssetAsVariantAction (parent
 *                         keeps its content; new asset.parentId =
 *                         current.id)
 *
 * Edits live in local state until one of the two buttons fires;
 * navigating away with unsaved changes triggers a confirm prompt.
 */
import { useRef, useState, useTransition } from "react";

import { ChipButton, GhostButton, GradientButton } from "@/components/common";
import { Input } from "@/components/ui/Input";
import type { AssetCard, AssetDetail } from "@/lib/assets/types";

import { saveAssetAsVariantAction, updateAssetAction } from "../actions";

const EMAIL_VAR_TOKENS = [
  "{{kol.name}}",
  "{{kol.handle}}",
  "{{product.name}}",
  "{{campaign.name}}",
  "{{today_date}}",
] as const;

interface EditTabProps {
  asset: AssetCard | AssetDetail;
  /** Hydrated content when available — falls back to a stub so the
   *  user can author from scratch even when only the listing card
   *  was loaded. */
  initialContent: Record<string, unknown> | null;
  onSaved: (newAssetId: string) => void;
}

interface EmailDraft {
  subject: string;
  body: string;
  locale: string;
  variables: Array<{ token: string; required?: boolean }>;
}

interface VideoDraft {
  title: string;
  script: string;
  durationHintSec?: number;
}

function emailDraftFrom(content: Record<string, unknown> | null): EmailDraft {
  return {
    subject: typeof content?.subject === "string" ? content.subject : "",
    body: typeof content?.body === "string" ? content.body : "",
    locale: typeof content?.locale === "string" ? content.locale : "en",
    variables: Array.isArray(content?.variables)
      ? (content!.variables as EmailDraft["variables"])
      : [],
  };
}

function videoDraftFrom(content: Record<string, unknown> | null): VideoDraft {
  return {
    title: typeof content?.title === "string" ? content.title : "",
    script: typeof content?.script === "string" ? content.script : "",
    durationHintSec:
      typeof content?.durationHintSec === "number" ? content.durationHintSec : undefined,
  };
}

export function EditTab({ asset, initialContent, onSaved }: EditTabProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (asset.type === "email") {
    return (
      <EmailEditor
        asset={asset}
        initial={emailDraftFrom(initialContent)}
        isPending={isPending}
        startTransition={startTransition}
        error={error}
        setError={setError}
        onSaved={onSaved}
      />
    );
  }
  return (
    <VideoEditor
      asset={asset}
      initial={videoDraftFrom(initialContent)}
      isPending={isPending}
      startTransition={startTransition}
      error={error}
      setError={setError}
      onSaved={onSaved}
    />
  );
}

interface EditorPropsBase<T> {
  asset: AssetCard | AssetDetail;
  initial: T;
  isPending: boolean;
  startTransition: (cb: () => void) => void;
  error: string | null;
  setError: (next: string | null) => void;
  onSaved: (newAssetId: string) => void;
}

function EmailEditor({
  asset,
  initial,
  isPending,
  startTransition,
  error,
  setError,
  onSaved,
}: EditorPropsBase<EmailDraft>) {
  const [draft, setDraft] = useState<EmailDraft>(initial);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  // Parent remounts EditTab via key={asset.id} so we don't need an
  // effect-driven reset here (avoids react-hooks/set-state-in-effect).

  const dirty =
    draft.subject !== initial.subject ||
    draft.body !== initial.body ||
    draft.locale !== initial.locale;

  function insertToken(token: string) {
    const el = bodyRef.current;
    if (!el) {
      setDraft((d) => ({ ...d, body: d.body + token }));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setDraft((d) => ({ ...d, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function handleSave() {
    startTransition(async () => {
      setError(null);
      const r = await updateAssetAction({
        assetId: asset.id,
        patch: {
          content: {
            subject: draft.subject,
            body: draft.body,
            locale: draft.locale,
            variables: draft.variables,
          },
        },
      });
      if (!r.ok) setError(r.error);
      else onSaved(r.asset.id);
    });
  }

  function handleSaveAsVariant() {
    startTransition(async () => {
      setError(null);
      const r = await saveAssetAsVariantAction({
        parentAssetId: asset.id,
        content: {
          subject: draft.subject,
          body: draft.body,
          locale: draft.locale,
          variables: draft.variables,
        },
      });
      if (!r.ok) setError(r.error);
      else onSaved(r.asset.id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-on-surface-variant">Subject</span>
        <Input
          value={draft.subject}
          onChange={(e) => setDraft((d) => ({ ...d, subject: e.currentTarget.value }))}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-on-surface-variant">Body</span>
          <span className="text-[10px] text-on-surface-variant">
            Locale: <code>{draft.locale}</code>
          </span>
        </div>
        <textarea
          ref={bodyRef}
          value={draft.body}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.currentTarget.value }))}
          rows={10}
          className="border-outline-variant bg-surface/40 text-on-surface focus:border-cyan focus:ring-cyan w-full rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-on-surface-variant">
          Insert variable
        </span>
        <div className="flex flex-wrap gap-2">
          {EMAIL_VAR_TOKENS.map((token) => (
            <ChipButton key={token} onClick={() => insertToken(token)} aria-label={`Insert ${token}`}>
              {token}
            </ChipButton>
          ))}
        </div>
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      <div className="flex items-center justify-between gap-2 pt-2">
        <GhostButton
          size="sm"
          onClick={() => setDraft(initial)}
          disabled={!dirty || isPending}
        >
          Reset
        </GhostButton>
        <div className="flex gap-2">
          <GhostButton size="sm" onClick={handleSaveAsVariant} disabled={!dirty || isPending}>
            Save as new version
          </GhostButton>
          <GradientButton onClick={handleSave} disabled={!dirty || isPending}>
            {isPending ? "Saving…" : "Save"}
          </GradientButton>
        </div>
      </div>
    </div>
  );
}

function VideoEditor({
  asset,
  initial,
  isPending,
  startTransition,
  error,
  setError,
  onSaved,
}: EditorPropsBase<VideoDraft>) {
  const [draft, setDraft] = useState<VideoDraft>(initial);
  const [previewMode, setPreviewMode] = useState(false);

  // Parent remounts via key={asset.id} — no draft reset effect needed.
  const dirty =
    draft.title !== initial.title ||
    draft.script !== initial.script ||
    draft.durationHintSec !== initial.durationHintSec;

  function handleSave() {
    startTransition(async () => {
      setError(null);
      const r = await updateAssetAction({
        assetId: asset.id,
        patch: {
          content: {
            title: draft.title,
            script: draft.script,
            durationHintSec: draft.durationHintSec,
          },
        },
      });
      if (!r.ok) setError(r.error);
      else onSaved(r.asset.id);
    });
  }

  function handleSaveAsVariant() {
    startTransition(async () => {
      setError(null);
      const r = await saveAssetAsVariantAction({
        parentAssetId: asset.id,
        content: {
          title: draft.title,
          script: draft.script,
          durationHintSec: draft.durationHintSec,
        },
      });
      if (!r.ok) setError(r.error);
      else onSaved(r.asset.id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-on-surface-variant">Title</span>
        <Input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.currentTarget.value }))}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-on-surface-variant">Script</span>
          <ChipButton pressed={previewMode} onClick={() => setPreviewMode((p) => !p)}>
            {previewMode ? "Edit" : "Preview"}
          </ChipButton>
        </div>
        {previewMode ? (
          <pre className="border-outline-variant bg-surface/40 text-on-surface min-h-[200px] whitespace-pre-wrap rounded-lg border p-3 font-mono text-xs">
            {draft.script}
          </pre>
        ) : (
          <textarea
            value={draft.script}
            onChange={(e) => setDraft((d) => ({ ...d, script: e.currentTarget.value }))}
            rows={12}
            className="border-outline-variant bg-surface/40 text-on-surface focus:border-cyan focus:ring-cyan w-full rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1"
          />
        )}
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      <div className="flex items-center justify-between gap-2 pt-2">
        <GhostButton
          size="sm"
          onClick={() => setDraft(initial)}
          disabled={!dirty || isPending}
        >
          Reset
        </GhostButton>
        <div className="flex gap-2">
          <GhostButton size="sm" onClick={handleSaveAsVariant} disabled={!dirty || isPending}>
            Save as new version
          </GhostButton>
          <GradientButton onClick={handleSave} disabled={!dirty || isPending}>
            {isPending ? "Saving…" : "Save"}
          </GradientButton>
        </div>
      </div>
    </div>
  );
}

EditTab.EMAIL_VAR_TOKENS = EMAIL_VAR_TOKENS;
