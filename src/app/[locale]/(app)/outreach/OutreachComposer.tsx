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
import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  FieldError,
  FieldHint,
  Input,
  Label,
  Textarea,
} from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { StatusBadge } from "@/components/common/StatusBadge";
import { substituteSubjectAndBody } from "@/lib/email/variable-substitute";

import {
  customizeAction,
  sendBatchAction,
  updateKolEmailAction,
  type ComposerActionState,
} from "./actions";
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
}

interface Props {
  data: OutreachComposerData;
  activeCampaignId: string | null;
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
  locale,
  labels,
}: Props) {
  const router = useRouter();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    activeCampaignId
  );
  const selectedCampaign = data.selectedCampaign;

  // KOL selection state — only enable KOLs with email. Parent page
  // remounts this component via `key={campaignId}` so switching
  // campaigns naturally resets `checked` without a setState-in-effect.
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  const selectableKols = useMemo(
    () => (selectedCampaign?.kols ?? []).filter((k) => !!k.email),
    [selectedCampaign]
  );

  const [templateId, setTemplateId] = useState<string>(
    data.templates[0]?.id ?? ""
  );
  const activeTemplate: OutreachTemplateOption | null = useMemo(
    () => data.templates.find((t) => t.id === templateId) ?? null,
    [data.templates, templateId]
  );

  // Preview uses the first selected / first available KOL for variable
  // substitution. Server-side send will substitute per-row.
  const previewKol =
    (checked.size > 0
      ? selectableKols.find((k) => checked.has(k.kolId))
      : selectableKols[0]) ?? null;

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
    () =>
      substituteSubjectAndBody(
        { subject: activeSubject, body: activeBody },
        previewVars
      ),
    [activeSubject, activeBody, previewVars]
  );

  const [aiOpen, setAiOpen] = useState(false);
  const [aiState, setAiState] = useState(initialCustomizeState);
  const [aiPending, startAi] = useTransition();
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
      className="glass-panel rounded-2xl border border-cyan/20 p-6 shadow-[0_0_30px_rgba(0,229,255,0.05)]"
    >
      <header className="mb-6">
        <h2
          data-testid="outreach-composer-title"
          className="text-xl font-bold text-white"
        >
          {labels.title}
        </h2>
        <p className="text-sm text-on-surface-variant">{labels.subtitle}</p>
      </header>

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
                next === ""
                  ? `/${locale}/outreach`
                  : `/${locale}/outreach?campaignId=${next}`;
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

        <div>
          <Label htmlFor="outreach-template-select" required>
            {labels.templateLabel}
          </Label>
          <Select
            id="outreach-template-select"
            data-testid="outreach-template-select"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              setOverrideTemplate(null);
            }}
            disabled={data.templates.length === 0}
          >
            <option value="">{labels.templatePlaceholder}</option>
            {data.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.locale})
              </option>
            ))}
          </Select>
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
            className="rounded-xl border border-outline-variant/60 bg-surface/30 p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              {labels.previewSubject}
            </p>
            <p
              data-testid="outreach-preview-subject"
              className="mt-1 mb-4 text-sm font-semibold text-white"
            >
              {preview.subject || "—"}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              {labels.previewBody}
            </p>
            <pre
              data-testid="outreach-preview-body"
              className="mt-1 whitespace-pre-wrap text-sm text-on-surface"
            >
              {preview.body || "—"}
            </pre>
            {preview.missing.length > 0 ? (
              <p className="mt-3 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] text-warning">
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
              disabled={
                !previewKol || !activeTemplate || !selectedCampaign || aiPending
              }
              data-testid="outreach-ai-customize-trigger"
            >
              <span
                className="material-symbols-outlined text-[16px]"
                aria-hidden
              >
                auto_awesome
              </span>
              {aiPending ? labels.aiCustomizePending : labels.aiCustomizeButton}
            </Button>
            {overrideTemplate?.fromAi ? (
              <StatusBadge
                domain="email"
                status="sent"
                label="AI"
                pulse
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/5 pt-5">
        <div className="text-sm text-on-surface-variant">
          {labels.kolSelectedTemplate
            .replace("{count}", String(checked.size))
            .replace("{total}", String(selectableKols.length))}
        </div>
        <Button
          variant="primary-gradient"
          size="md"
          disabled={
            !selectedCampaign ||
            !activeTemplate ||
            checked.size === 0 ||
            sendPending
          }
          onClick={doSend}
          data-testid="outreach-send-button"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            aria-hidden
          >
            send
          </span>
          {sendPending ? labels.sendPending : labels.sendButton}
        </Button>
      </div>

      {sendError ? (
        <p
          data-testid="outreach-send-error"
          className="mt-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
        >
          {labels.errorLabels[sendError] ?? labels.errorLabels.generic}
        </p>
      ) : null}

      {sendResult ? (
        <div
          data-testid="outreach-send-result"
          className="mt-5 flex flex-col gap-3 rounded-xl border border-cyan/30 bg-cyan/5 p-4"
        >
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <span className="text-emerald-300">
              {labels.resultSentCountTemplate.replace(
                "{count}",
                String(sendResult.sent)
              )}
            </span>
            <span className="text-cyan">
              {labels.resultMockedCountTemplate.replace(
                "{count}",
                String(sendResult.mocked)
              )}
            </span>
            <span className="text-error">
              {labels.resultFailedCountTemplate.replace(
                "{count}",
                String(sendResult.failed)
              )}
            </span>
          </div>
          {sendResult.items.some((i) => i.status === "failed") ? (
            <ul className="flex flex-col gap-1 text-xs text-on-surface-variant">
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
        onRestore={restoreOriginal}
        onClose={() => setAiOpen(false)}
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
  const allSelected =
    selectable.length > 0 && selectable.every((k) => checked.has(k.kolId));
  const someSelected = selectable.some((k) => checked.has(k.kolId));

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <Label>{labels.kolSection}</Label>
        {selectable.length === 0 ? (
          <span className="text-xs text-on-surface-variant">
            {labels.noSelectableKols}
          </span>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-white/5 bg-surface/30">
        <table
          data-testid="outreach-kol-table"
          className="w-full border-collapse text-left text-sm"
        >
          <thead>
            <tr className="border-b border-white/5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
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
      className="border-b border-white/5 text-sm text-on-surface last:border-none hover:bg-white/[0.03]"
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
            className="block h-5 w-5 rounded border border-outline-variant/60 opacity-50"
          />
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-semibold text-white">{kol.displayName}</span>
          <span className="text-xs text-on-surface-variant">
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
              {patchError
                ? labels.errorLabels[patchError] ?? labels.addEmailInvalid
                : null}
            </FieldError>
          </div>
        ) : hasEmail ? (
          <span className="text-xs text-on-surface">{currentEmail}</span>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xs italic text-on-surface-variant/70">
              {labels.noEmail}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingEmail(true)}
              data-testid="outreach-add-email-button"
            >
              <span
                className="material-symbols-outlined text-[14px]"
                aria-hidden
              >
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
  onRestore,
  onClose,
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
  onRestore: () => void;
  onClose: () => void;
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
            <div className="rounded-xl border border-white/5 bg-surface/30 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                {labels.aiCustomizeOriginal}
              </p>
              <p className="mb-3 text-sm font-semibold text-white">
                {originalSubject || "—"}
              </p>
              <pre className="whitespace-pre-wrap text-xs text-on-surface">
                {originalBody || "—"}
              </pre>
            </div>
            <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-3">
              <p className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-cyan">
                <span
                  className="material-symbols-outlined text-[14px]"
                  aria-hidden
                >
                  auto_awesome
                </span>
                {labels.aiCustomizeAi}
              </p>
              {pending ? (
                <p className="text-xs text-on-surface-variant">
                  {labels.aiCustomizePending}
                </p>
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
                  className="rounded border border-error/30 bg-error/10 px-2 py-1 text-xs text-error"
                >
                  {labels.errorLabels[state.error] ?? labels.errorLabels.generic}
                </p>
              ) : (
                <p className="text-xs text-on-surface-variant">—</p>
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
              variant="primary-gradient"
              size="sm"
              disabled={!state.ok || pending}
              onClick={onAccept}
              data-testid="outreach-ai-customize-accept"
            >
              {labels.aiCustomizeUseAi}
            </Button>
          </DialogFooter>
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}
