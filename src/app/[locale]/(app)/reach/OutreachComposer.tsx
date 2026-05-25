"use client";

/**
 * BM2-F006 · Outreach composer (client).
 *
 * 8-step composer from spec §F006:
 *   1. Campaign selector
 *   2. KOL row table (checkbox per row; inline "add email" for missing
 *      addresses; status select stays read-only — status changes come
 *      from the batch-send step)
 *   3. Template selector
 *   4. Preview (subject + body after variable substitution)
 *   5. AI customize dialog (left = original, right = AI rewrite)
 *   6. Send button (server-action batch)
 *   7. Result summary (sent / mocked / failed, with per-KOL reasons)
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import {
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/Dialog";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TagChip } from "@/components/common/TagChip";
import { substituteSubjectAndBody } from "@/lib/email/variable-substitute";
import { cn } from "@/lib/utils";

import {
  customizeAction,
  sendBatchAction,
  saveTemplateAction,
  updateKolEmailAction,
  type ComposerActionState,
} from "./actions";
import { useProductFilter } from "./useProductFilter";
import type {
  OutreachCampaignOption,
  OutreachComposerData,
  OutreachKolRow,
  OutreachTemplateOption,
} from "@/lib/email/composer-data";

interface Labels {
  title: string;
  subtitle: string;
  campaignLabel: string;
  campaignPlaceholder: string;
  templateLabel: string;
  templatePlaceholder: string;
  templateSystemGroup: string;
  templateUserGroup: string;
  kolSection: string;
  kolSelectedTemplate: string;
  kolHeadSelect: string;
  kolHeadCreator: string;
  kolHeadEmail: string;
  kolHeadStatus: string;
  noEmail: string;
  noEmailTooltip: string;
  addEmailButton: string;
  addEmailSave: string;
  addEmailCancel: string;
  addEmailInvalid: string;
  previewTitle: string;
  previewSubject: string;
  previewBody: string;
  missingTokensWarningTemplate: string;
  aiCustomizeButton: string;
  aiCustomizeTitle: string;
  aiCustomizeOriginal: string;
  aiCustomizeAi: string;
  aiCustomizeUseOriginal: string;
  aiCustomizeUseAi: string;
  aiCustomizeSaveAsTemplate: string;
  aiCustomizeSavePending: string;
  aiCustomizeClose: string;
  aiCustomizePending: string;
  sendButton: string;
  sendPending: string;
  resultSentCountTemplate: string;
  resultMockedCountTemplate: string;
  resultFailedCountTemplate: string;
  resultDismiss: string;
  statusLabels: Record<string, string>;
  errorLabels: Record<string, string>;
  selectAllLabel: string;
  noSelectableKols: string;
  // BL-035-F008: optional UX hint shown when checked.size > 8.
  // Falls back to "Limit 8 per send." when the parent omits it.
  batchTooLargeHint?: string;
}

interface Props {
  data: OutreachComposerData;
  activeCampaignId: string | null;
  /**
   * BIx-mvp-polish-pass F002 P1-4: when /database "Email selected"
   * routes here with `?kolIds=a,b,c`, pre-tick those rows in the
   * composer KOL list (intersected with the campaign's actually-
   * selectable rows so we don't tick missing ids).
   */
  preselectedKolIds?: string[];
  locale: string;
  labels: Labels;
}

const initialCustomizeState: ComposerActionState<{
  subject: string;
  body: string;
  rationale?: string;
  traceId?: string;
}> = { ok: false };
const initialPatchState: ComposerActionState = { ok: false };

export function OutreachComposer({
  data,
  activeCampaignId,
  preselectedKolIds,
  locale,
  labels,
}: Props) {
  const router = useRouter();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(activeCampaignId);
  const selectedCampaign = data.selectedCampaign;

  // KOL selection state — only enable KOLs with email. Parent page
  // remounts this component via `key={campaignId}` so switching
  // campaigns naturally resets `checked` without a setState-in-effect.
  // BIx-mvp-polish-pass F002 P1-4: seed the Set from `preselectedKolIds`
  // when the URL carries `?kolIds=...` (intersected with the campaign's
  // selectable rows so we never tick a kol that isn't visible).
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (!preselectedKolIds?.length) return new Set();
    const visibleIds = new Set(
      (data.selectedCampaign?.kols ?? []).filter((k) => !!k.email).map((k) => k.kolId)
    );
    return new Set(preselectedKolIds.filter((id) => visibleIds.has(id)));
  });

  const selectableKols = useMemo(
    () => (selectedCampaign?.kols ?? []).filter((k) => !!k.email),
    [selectedCampaign]
  );

  // BL-025-F008: when /assets sends an email asset over via the
  // `prefilledAssetId` query param, prefer it over the default
  // first-template selection so the composer opens already focused
  // on the chosen asset. Falls back to the first available template
  // if the asset isn't visible (e.g. archived, cross-tenant, stale link).
  const searchParamsHook = useSearchParams();
  const prefilledAssetId = searchParamsHook?.get("prefilledAssetId") ?? null;
  const prefilledMatch = useMemo(
    () =>
      prefilledAssetId
        ? (data.templates.find((t) => t.id === prefilledAssetId) ?? null)
        : null,
    [prefilledAssetId, data.templates]
  );
  const initialTemplateId = prefilledMatch?.id ?? data.templates[0]?.id ?? "";

  // Toast banner — non-null while the user lands from /assets so they
  // see confirmation (or a fallback if the link is stale). Derived
  // from inputs + a dismiss flag so we don't need a synchronous
  // setState inside useEffect (lint rule react-hooks/set-state-in-effect).
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const prefilledBanner = useMemo<{
    kind: "ok" | "missing";
    text: string;
  } | null>(() => {
    if (bannerDismissed || !prefilledAssetId) return null;
    if (prefilledMatch) {
      return {
        kind: "ok",
        text: `Loaded template from /assets · ${prefilledMatch.name}`,
      };
    }
    return {
      kind: "missing",
      text: "Template not available — falling back to default",
    };
  }, [bannerDismissed, prefilledAssetId, prefilledMatch]);
  useEffect(() => {
    if (!prefilledBanner) return;
    const handle = window.setTimeout(() => setBannerDismissed(true), 4000);
    return () => window.clearTimeout(handle);
  }, [prefilledBanner]);

  const [templateId, setTemplateId] = useState<string>(initialTemplateId);
  const activeTemplate: OutreachTemplateOption | null = useMemo(
    () => data.templates.find((t) => t.id === templateId) ?? null,
    [data.templates, templateId]
  );

  // Preview uses the first selected / first available KOL for variable
  // substitution. Server-side send will substitute per-row.
  const previewKol =
    (checked.size > 0 ? selectableKols.find((k) => checked.has(k.kolId)) : selectableKols[0]) ??
    null;

  const previewVars = useMemo(
    () => ({
      kol: {
        name: previewKol?.displayName ?? "",
        handle: previewKol?.handle,
      },
      product: {
        name: selectedCampaign?.productName ?? "",
        category: selectedCampaign?.productCategory,
        usp: selectedCampaign?.productUsp,
      },
      marketer: { name: data.marketerName },
      date: new Date().toISOString().slice(0, 10),
    }),
    [previewKol, selectedCampaign, data.marketerName]
  );

  const [overrideTemplate, setOverrideTemplate] = useState<{
    subject: string;
    body: string;
    fromAi: boolean;
  } | null>(null);

  const activeSubject = overrideTemplate?.subject ?? activeTemplate?.subject ?? "";
  const activeBody = overrideTemplate?.body ?? activeTemplate?.body ?? "";

  const preview = useMemo(
    () => substituteSubjectAndBody({ subject: activeSubject, body: activeBody }, previewVars),
    [activeSubject, activeBody, previewVars]
  );

  const [aiOpen, setAiOpen] = useState(false);
  const [aiState, setAiState] = useState(initialCustomizeState);
  const [aiPending, startAi] = useTransition();
  const [savePending, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiEditedSubject, setAiEditedSubject] = useState("");
  const [aiEditedBody, setAiEditedBody] = useState("");

  const runCustomize = () => {
    if (!selectedCampaign || !previewKol || !activeTemplate) return;
    setAiState({ ok: false });
    setAiOpen(true);
    startAi(async () => {
      const fd = new FormData();
      fd.set("campaignId", selectedCampaign.id);
      fd.set("kolId", previewKol.kolId);
      fd.set("templateId", activeTemplate.id);
      const result = await customizeAction({ ok: false }, fd);
      setAiState(result);
      if (result.ok && result.data) {
        setAiEditedSubject(result.data.subject);
        setAiEditedBody(result.data.body);
      }
    });
  };

  const acceptAi = () => {
    setOverrideTemplate({
      subject: aiEditedSubject,
      body: aiEditedBody,
      fromAi: true,
    });
    setAiOpen(false);
  };
  const saveAiAsTemplate = () => {
    if (!activeTemplate) return;
    setSaveError(null);
    startSave(async () => {
      const fd = new FormData();
      fd.set("name", `${activeTemplate.name} (Custom)`);
      fd.set("subject", aiEditedSubject || activeTemplate.subject);
      fd.set("body", aiEditedBody || activeTemplate.body);
      fd.set("locale", activeTemplate.locale);
      fd.set(
        "variables",
        JSON.stringify((activeTemplate as OutreachTemplateOption).variables ?? [])
      );
      fd.set("sourceTemplateId", activeTemplate.id);
      const result = await saveTemplateAction({ ok: false }, fd);
      if (!result.ok || !result.data) {
        setSaveError(result.error ?? "generic");
        return;
      }
      setTemplateId(result.data.id);
      setOverrideTemplate({
        subject: result.data.subject,
        body: result.data.body,
        fromAi: true,
      });
      setAiOpen(false);
      router.refresh();
    });
  };
  const restoreOriginal = () => {
    setOverrideTemplate(null);
    setAiOpen(false);
  };

  const [sendPending, startSend] = useTransition();
  const [sendResult, setSendResult] = useState<{
    sent: number;
    mocked: number;
    failed: number;
    items: Array<{ kolId: string; status: string; error?: string }>;
  } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const doSend = () => {
    if (!selectedCampaign || !activeTemplate || checked.size === 0) return;
    setSendError(null);
    const items = selectableKols
      .filter((k) => checked.has(k.kolId))
      .map((k) => {
        const perKolVars = {
          kol: { name: k.displayName, handle: k.handle },
          product: {
            name: selectedCampaign.productName ?? "",
            category: selectedCampaign.productCategory,
            usp: selectedCampaign.productUsp,
          },
          marketer: { name: data.marketerName },
          date: new Date().toISOString().slice(0, 10),
        };
        const sub = substituteSubjectAndBody(
          { subject: activeSubject, body: activeBody },
          perKolVars
        );
        return {
          kolId: k.kolId,
          toAddress: k.email!,
          subject: sub.subject,
          bodyText: sub.body,
          templateId: activeTemplate.id,
          aiCustomized: overrideTemplate?.fromAi ?? false,
        };
      });

    startSend(async () => {
      const result = await sendBatchAction({
        campaignId: selectedCampaign.id,
        aiAccepted: overrideTemplate?.fromAi ?? false,
        items,
      });
      if (!result.ok) {
        setSendError(result.error ?? "generic");
        return;
      }
      setSendResult(result.data ?? { sent: 0, mocked: 0, failed: 0, items: [] });
      setChecked(new Set());
      router.refresh();
    });
  };

  return (
    <section
      id="composer"
      data-testid="outreach-composer"
      className="glass-panel border-cyan/20 rounded-2xl border p-6 shadow-[0_0_30px_rgba(0,229,255,0.05)]"
    >
      <header className="mb-6">
        <h2 data-testid="outreach-composer-title" className="text-xl font-bold text-white">
          {labels.title}
        </h2>
        <p className="text-on-surface-variant text-sm">{labels.subtitle}</p>
      </header>

      {prefilledBanner ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="outreach-prefilled-banner"
          className={
            prefilledBanner.kind === "ok"
              ? "border-cyan/40 bg-cyan/10 text-on-surface mb-4 rounded-lg border px-3 py-2 text-xs"
              : "mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
          }
        >
          {prefilledBanner.text}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <Label htmlFor="outreach-campaign-select" required>
            {labels.campaignLabel}
          </Label>
          <Select
            id="outreach-campaign-select"
            data-testid="outreach-campaign-select"
            value={selectedCampaignId ?? ""}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedCampaignId(next || null);
              const url =
                next === "" ? `/${locale}/reach` : `/${locale}/reach?campaignId=${next}`;
              router.push(url);
            }}
          >
            <option value="">{labels.campaignPlaceholder}</option>
            {data.campaigns.map((c: OutreachCampaignOption) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.productName ? ` · ${c.productName}` : ""}
                {c.kolCount > 0 ? ` (${c.kolCount} KOL)` : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="md:col-span-1">
          <Label required>{labels.templateLabel}</Label>
          {/* BL-026-F005 — search + product filter row replaces the
              <Select> dropdown. Templates are filtered client-side
              against the initial up-to-100-row payload (light path);
              loadAssetsForComposer accepts the same params for a
              future incremental-search server upgrade. */}
          <TemplatePicker
            templates={data.templates}
            templateId={templateId}
            onSelect={(id) => {
              setTemplateId(id);
              setOverrideTemplate(null);
            }}
            selectedCampaignProductId={selectedCampaign?.productId ?? null}
            templateSystemGroup={labels.templateSystemGroup}
            templateUserGroup={labels.templateUserGroup}
          />
        </div>
      </div>

      {selectedCampaign ? (
        <KolRowTable
          kols={selectedCampaign.kols}
          checked={checked}
          onToggle={(kolId) =>
            setChecked((prev) => {
              const next = new Set(prev);
              if (next.has(kolId)) next.delete(kolId);
              else next.add(kolId);
              return next;
            })
          }
          onSelectAll={() => {
            setChecked(new Set(selectableKols.map((k) => k.kolId)));
          }}
          onClearSelection={() => setChecked(new Set())}
          labels={labels}
        />
      ) : null}

      {activeTemplate ? (
        <div className="mt-6">
          <Label>{labels.previewTitle}</Label>
          <div
            data-testid="outreach-preview-panel"
            className="border-outline-variant/60 bg-surface/30 rounded-xl border p-4"
          >
            <p className="text-on-surface-variant text-[11px] font-bold tracking-widest uppercase">
              {labels.previewSubject}
            </p>
            <p
              data-testid="outreach-preview-subject"
              className="mt-1 mb-4 text-sm font-semibold text-white"
            >
              {preview.subject || "—"}
            </p>
            <p className="text-on-surface-variant text-[11px] font-bold tracking-widest uppercase">
              {labels.previewBody}
            </p>
            <pre
              data-testid="outreach-preview-body"
              className="text-on-surface mt-1 text-sm whitespace-pre-wrap"
            >
              {preview.body || "—"}
            </pre>
            {preview.missing.length > 0 ? (
              <p className="border-warning/40 bg-warning/10 text-warning mt-3 rounded border px-2 py-1 text-[11px]">
                {labels.missingTokensWarningTemplate.replace(
                  "{tokens}",
                  preview.missing.join(", ")
                )}
              </p>
            ) : null}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={runCustomize}
              disabled={!previewKol || !activeTemplate || !selectedCampaign || aiPending}
              data-testid="outreach-ai-customize-trigger"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                auto_awesome
              </span>
              {aiPending ? labels.aiCustomizePending : labels.aiCustomizeButton}
            </Button>
            {overrideTemplate?.fromAi ? (
              <StatusBadge domain="email" status="sent" label="AI" pulse />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/5 pt-5">
        <div className="text-on-surface-variant text-sm">
          {labels.kolSelectedTemplate
            .replace("{count}", String(checked.size))
            .replace("{total}", String(selectableKols.length))}
          {checked.size > 8 ? (
            // BL-035-F008: server-side cap is 8 per batch. Surface
            // the limit before the user clicks Send so they can
            // narrow the selection rather than discover the cap via
            // the `batch_too_large` error toast.
            <span
              className="text-amber-300 ml-2"
              data-testid="outreach-batch-cap-hint"
            >
              {labels.batchTooLargeHint ?? "Limit 8 per send."}
            </span>
          ) : null}
        </div>
        <Button
          variant="primary-gradient"
          size="md"
          disabled={
            !selectedCampaign ||
            !activeTemplate ||
            checked.size === 0 ||
            checked.size > 8 ||
            sendPending
          }
          onClick={doSend}
          data-testid="outreach-send-button"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            send
          </span>
          {sendPending ? labels.sendPending : labels.sendButton}
        </Button>
      </div>

      {sendError ? (
        <p
          data-testid="outreach-send-error"
          className="border-error/30 bg-error/10 text-error mt-3 rounded-lg border px-3 py-2 text-sm"
        >
          {labels.errorLabels[sendError] ?? labels.errorLabels.generic}
        </p>
      ) : null}

      {sendResult ? (
        <div
          data-testid="outreach-send-result"
          className="border-cyan/30 bg-cyan/5 mt-5 flex flex-col gap-3 rounded-xl border p-4"
        >
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <span className="text-emerald-300">
              {labels.resultSentCountTemplate.replace("{count}", String(sendResult.sent))}
            </span>
            <span className="text-cyan">
              {labels.resultMockedCountTemplate.replace("{count}", String(sendResult.mocked))}
            </span>
            <span className="text-error">
              {labels.resultFailedCountTemplate.replace("{count}", String(sendResult.failed))}
            </span>
          </div>
          {sendResult.items.some((i) => i.status === "failed") ? (
            <ul className="text-on-surface-variant flex flex-col gap-1 text-xs">
              {sendResult.items
                .filter((i) => i.status === "failed")
                .map((i) => (
                  <li key={i.kolId}>
                    <span className="font-mono">{i.kolId.slice(0, 8)}</span>
                    {" · "}
                    {i.error ?? "unknown"}
                  </li>
                ))}
            </ul>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSendResult(null)}
            data-testid="outreach-send-result-dismiss"
          >
            {labels.resultDismiss}
          </Button>
        </div>
      ) : null}

      <AiCustomizeDialog
        open={aiOpen}
        pending={aiPending}
        state={aiState}
        originalSubject={activeTemplate?.subject ?? ""}
        originalBody={activeTemplate?.body ?? ""}
        editedSubject={aiEditedSubject}
        editedBody={aiEditedBody}
        onEditedSubject={setAiEditedSubject}
        onEditedBody={setAiEditedBody}
        onAccept={acceptAi}
        onSaveAsTemplate={saveAiAsTemplate}
        onRestore={restoreOriginal}
        onClose={() => setAiOpen(false)}
        savePending={savePending}
        saveError={saveError}
        labels={labels}
      />
    </section>
  );
}

// ---- KOL row table ---------------------------------------------------

function KolRowTable({
  kols,
  checked,
  onToggle,
  onSelectAll,
  onClearSelection,
  labels,
}: {
  kols: OutreachKolRow[];
  checked: Set<string>;
  onToggle: (kolId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  labels: Labels;
}) {
  const selectable = kols.filter((k) => !!k.email);
  const allSelected = selectable.length > 0 && selectable.every((k) => checked.has(k.kolId));
  const someSelected = selectable.some((k) => checked.has(k.kolId));

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <Label>{labels.kolSection}</Label>
        {selectable.length === 0 ? (
          <span className="text-on-surface-variant text-xs">{labels.noSelectableKols}</span>
        ) : null}
      </div>
      <div className="bg-surface/30 overflow-hidden rounded-xl border border-white/5">
        <table
          data-testid="outreach-kol-table"
          className="w-full border-collapse text-left text-sm"
        >
          <thead>
            <tr className="text-on-surface-variant border-b border-white/5 text-[11px] font-bold tracking-widest uppercase">
              <th className="w-12 px-4 py-3">
                <Checkbox
                  aria-label={labels.selectAllLabel}
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onCheckedChange={(next) => {
                    if (next) onSelectAll();
                    else onClearSelection();
                  }}
                />
              </th>
              <th className="px-4 py-3">{labels.kolHeadCreator}</th>
              <th className="px-4 py-3">{labels.kolHeadEmail}</th>
              <th className="px-4 py-3">{labels.kolHeadStatus}</th>
            </tr>
          </thead>
          <tbody>
            {kols.map((k) => (
              <KolRow
                key={k.kolCampaignId}
                kol={k}
                isChecked={checked.has(k.kolId)}
                onToggle={() => onToggle(k.kolId)}
                labels={labels}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KolRow({
  kol,
  isChecked,
  onToggle,
  labels,
}: {
  kol: OutreachKolRow;
  isChecked: boolean;
  onToggle: () => void;
  labels: Labels;
}) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [patchError, setPatchError] = useState<string | null>(null);
  const [patchPending, startPatch] = useTransition();
  const [currentEmail, setCurrentEmail] = useState<string | null>(kol.email);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingEmail) inputRef.current?.focus();
  }, [editingEmail]);

  const hasEmail = currentEmail != null && currentEmail.length > 0;

  const submitPatch = () => {
    setPatchError(null);
    startPatch(async () => {
      const fd = new FormData();
      fd.set("kolId", kol.kolId);
      fd.set("email", emailDraft.trim());
      const result = await updateKolEmailAction(initialPatchState, fd);
      if (!result.ok) {
        setPatchError(result.error ?? "generic");
      } else {
        setCurrentEmail(emailDraft.trim());
        setEditingEmail(false);
      }
    });
  };

  return (
    <tr
      className="text-on-surface border-b border-white/5 text-sm last:border-none hover:bg-white/[0.03]"
      data-testid="outreach-kol-row"
      data-kol-id={kol.kolId}
    >
      <td className="px-4 py-3">
        {hasEmail ? (
          <Checkbox
            aria-label={`${labels.selectAllLabel} — ${kol.displayName}`}
            checked={isChecked}
            onCheckedChange={() => onToggle()}
          />
        ) : (
          <span
            title={labels.noEmailTooltip}
            className="border-outline-variant/60 block h-5 w-5 rounded border opacity-50"
          />
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-semibold text-white">{kol.displayName}</span>
          <span className="text-on-surface-variant text-xs">
            @{kol.handle} · {kol.platform}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        {editingEmail ? (
          <div className="flex max-w-xs flex-col gap-2">
            <Input
              ref={inputRef}
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="kol@example.com"
              data-testid="outreach-add-email-input"
              invalid={!!patchError}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary-gradient"
                onClick={submitPatch}
                disabled={patchPending || emailDraft.trim() === ""}
                data-testid="outreach-add-email-save"
              >
                {labels.addEmailSave}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingEmail(false);
                  setEmailDraft("");
                  setPatchError(null);
                }}
              >
                {labels.addEmailCancel}
              </Button>
            </div>
            <FieldError>
              {patchError ? (labels.errorLabels[patchError] ?? labels.addEmailInvalid) : null}
            </FieldError>
          </div>
        ) : hasEmail ? (
          <span className="text-on-surface text-xs">{currentEmail}</span>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-on-surface-variant/70 text-xs italic">{labels.noEmail}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingEmail(true)}
              data-testid="outreach-add-email-button"
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden>
                edit
              </span>
              {labels.addEmailButton}
            </Button>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge
          domain="kolCampaign"
          status={kol.contactStatus}
          label={labels.statusLabels[kol.contactStatus] ?? kol.contactStatus}
        />
      </td>
    </tr>
  );
}

// ---- AI customize dialog --------------------------------------------

function AiCustomizeDialog({
  open,
  pending,
  state,
  originalSubject,
  originalBody,
  editedSubject,
  editedBody,
  onEditedSubject,
  onEditedBody,
  onAccept,
  onSaveAsTemplate,
  onRestore,
  onClose,
  savePending,
  saveError,
  labels,
}: {
  open: boolean;
  pending: boolean;
  state: ComposerActionState<{
    subject: string;
    body: string;
    rationale?: string;
    traceId?: string;
  }>;
  originalSubject: string;
  originalBody: string;
  editedSubject: string;
  editedBody: string;
  onEditedSubject: (v: string) => void;
  onEditedBody: (v: string) => void;
  onAccept: () => void;
  onSaveAsTemplate: () => void;
  onRestore: () => void;
  onClose: () => void;
  savePending: boolean;
  saveError: string | null;
  labels: Labels;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPanel size="lg" data-testid="outreach-ai-customize-dialog">
          <DialogHeader>
            <DialogTitle>{labels.aiCustomizeTitle}</DialogTitle>
            <button
              type="button"
              aria-label={labels.aiCustomizeClose}
              onClick={onClose}
              className="text-on-surface-variant hover:text-cyan"
            >
              <span className="material-symbols-outlined" aria-hidden>
                close
              </span>
            </button>
          </DialogHeader>
          <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-2">
            <div className="bg-surface/30 rounded-xl border border-white/5 p-3">
              <p className="text-on-surface-variant mb-2 text-[11px] font-bold tracking-widest uppercase">
                {labels.aiCustomizeOriginal}
              </p>
              <p className="mb-3 text-sm font-semibold text-white">{originalSubject || "—"}</p>
              <pre className="text-on-surface text-xs whitespace-pre-wrap">
                {originalBody || "—"}
              </pre>
            </div>
            <div className="border-cyan/30 bg-cyan/5 rounded-xl border p-3">
              <p className="text-cyan mb-2 flex items-center gap-1 text-[11px] font-bold tracking-widest uppercase">
                <span className="material-symbols-outlined text-[14px]" aria-hidden>
                  auto_awesome
                </span>
                {labels.aiCustomizeAi}
              </p>
              {pending ? (
                <p className="text-on-surface-variant text-xs">{labels.aiCustomizePending}</p>
              ) : state.ok ? (
                <div className="flex flex-col gap-2">
                  <Input
                    value={editedSubject}
                    onChange={(e) => onEditedSubject(e.target.value)}
                    data-testid="outreach-ai-customize-subject"
                  />
                  <Textarea
                    rows={6}
                    value={editedBody}
                    onChange={(e) => onEditedBody(e.target.value)}
                    data-testid="outreach-ai-customize-body"
                  />
                  <FieldHint>{state.data?.rationale ?? null}</FieldHint>
                </div>
              ) : state.error ? (
                <p
                  role="alert"
                  data-testid="outreach-ai-customize-error"
                  className="border-error/30 bg-error/10 text-error rounded border px-2 py-1 text-xs"
                >
                  {labels.errorLabels[state.error] ?? labels.errorLabels.generic}
                </p>
              ) : (
                <p className="text-on-surface-variant text-xs">—</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRestore}
              data-testid="outreach-ai-customize-restore"
            >
              {labels.aiCustomizeUseOriginal}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onSaveAsTemplate}
              disabled={!state.ok || pending || savePending}
              data-testid="outreach-ai-customize-save-template"
            >
              {savePending ? labels.aiCustomizeSavePending : labels.aiCustomizeSaveAsTemplate}
            </Button>
            <Button
              variant="primary-gradient"
              size="sm"
              disabled={!state.ok || pending}
              onClick={onAccept}
              data-testid="outreach-ai-customize-accept"
            >
              {labels.aiCustomizeUseAi}
            </Button>
          </DialogFooter>
          {saveError ? (
            <p className="text-error px-5 pb-4 text-xs" role="alert">
              {labels.errorLabels[saveError] ?? labels.errorLabels.generic}
            </p>
          ) : null}
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}

// ---- BL-026-F005 · Template picker (search + product filter) -------

interface TemplatePickerProps {
  templates: OutreachTemplateOption[];
  templateId: string;
  onSelect: (id: string) => void;
  /**
   * BL-031-F002 (D2) — campaign-scoped default for the product filter.
   * When the user lands on /outreach with a campaign selected, the
   * dropdown auto-narrows to that campaign's product so they don't
   * have to manually pick the matching product to see their templates.
   * `null` (campaign without product, or no campaign selected) keeps
   * the filter as "All products". The TemplatePicker stays mounted
   * across campaign switches in the test layer (parent uses
   * `key={campaignId}` to remount in production, but unit tests
   * exercise the rerender path to assert sync behaviour).
   */
  selectedCampaignProductId: string | null;
  templateSystemGroup: string;
  templateUserGroup: string;
}

function TemplatePicker({
  templates,
  templateId,
  onSelect,
  selectedCampaignProductId,
  templateSystemGroup,
  templateUserGroup,
}: TemplatePickerProps) {
  // BL-072-F003 — the picker is a deep client-only sub-component; the
  // surrounding composer threads ~40 label props from the server, but
  // calling `useTranslations` directly here keeps the picker's i18n
  // local rather than ballooning the parent contract for the 5 new
  // strings (filter / search / empty states).
  const tPicker = useTranslations("outreach.composer.templatePicker");
  const [productFilter, onProductFilterChange] = useProductFilter(selectedCampaignProductId);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // 300ms debounce so the list doesn't reflow per keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setSearchQuery(searchDraft), 300);
    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of templates) {
      if (t.productId && t.productName && !seen.has(t.productId)) {
        seen.set(t.productId, t.productName);
      }
    }
    return Array.from(seen, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    let items: OutreachTemplateOption[] = [...templates];
    if (productFilter) {
      items = items.filter((t) => t.productId === productFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      items = items.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.subject ?? "").toLowerCase().includes(q)
      );
    }
    return items.slice(0, 20);
  }, [templates, productFilter, searchQuery]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Combobox
          items={productOptions}
          value={productFilter}
          onChange={onProductFilterChange}
          placeholder={tPicker("filterPlaceholder")}
          ariaLabel={tPicker("filterAria")}
        />
        <Input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.currentTarget.value)}
          placeholder={tPicker("searchPlaceholder")}
          aria-label={tPicker("searchAria")}
          data-testid="outreach-template-search"
        />
      </div>
      <ul
        role="listbox"
        aria-label={tPicker("listAria")}
        data-testid="outreach-template-list"
        className={cn(
          "border-outline-variant bg-surface/30 max-h-[280px] overflow-y-auto rounded-xl border"
        )}
      >
        {templates.length === 0 ? (
          <li className="text-on-surface-variant p-3 text-xs">{tPicker("noTemplates")}</li>
        ) : filteredTemplates.length === 0 ? (
          <li className="text-on-surface-variant p-3 text-xs">
            {tPicker("noMatches")}
          </li>
        ) : (
          filteredTemplates.map((t) => {
            const selected = t.id === templateId;
            return (
              <li
                key={t.id}
                role="option"
                aria-selected={selected}
                data-testid="outreach-template-option"
                data-template-id={t.id}
                onClick={() => onSelect(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(t.id);
                  }
                }}
                tabIndex={0}
                className={cn(
                  "border-outline-variant/40 flex cursor-pointer flex-col gap-1 border-b p-3 text-sm last:border-b-0",
                  "hover:bg-cyan/5 focus-visible:bg-cyan/10",
                  "focus-visible:ring-cyan/40 focus-visible:ring-2 focus-visible:outline-none",
                  selected && "bg-cyan/10 border-l-2 border-l-cyan"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-on-surface font-medium">{t.name}</span>
                  <TagChip
                    label={t.scope === "system" ? templateSystemGroup : templateUserGroup}
                    tone={t.scope === "system" ? "cyan" : "neutral"}
                    size="xs"
                  />
                  {t.productName ? (
                    <span className="text-on-surface-variant text-[11px]">
                      · {t.productName}
                    </span>
                  ) : null}
                  <span className="text-on-surface-variant ml-auto text-[10px] uppercase">
                    {t.locale}
                  </span>
                </div>
                {t.subject ? (
                  <p className="text-on-surface-variant line-clamp-1 text-xs">{t.subject}</p>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
