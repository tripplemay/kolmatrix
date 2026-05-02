"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { TemplateBodyMarkdown } from "./TemplateBodyMarkdown";
import {
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { substituteSubjectAndBody } from "@/lib/email/variable-substitute";

import {
  customizeAction,
  deleteTemplateAction,
  duplicateTemplateAction,
  saveTemplateAction,
  type ComposerActionState,
} from "../actions";
import type {
  OutreachComposerData,
  OutreachTemplateOption,
} from "@/lib/email/composer-data";

type LocaleFilter = "all" | "en" | "zh";

interface Labels {
  title: string;
  subtitle: string;
  breadcrumbRoot: string;
  breadcrumbSection: string;
  draft: string;
  systemTemplates: string;
  myTemplates: string;
  searchPlaceholder: string;
  localeAll: string;
  localeEn: string;
  localeZh: string;
  templateLabel: string;
  templatePlaceholder: string;
  newTemplate: string;
  saveTemplate: string;
  saveTemplateAs: string;
  duplicateTemplate: string;
  deleteTemplate: string;
  previewTitle: string;
  previewSubject: string;
  previewBody: string;
  subjectLabel: string;
  bodyLabel: string;
  nameLabel: string;
  aiButton: string;
  aiPending: string;
  aiTitle: string;
  aiOriginal: string;
  aiRewritten: string;
  aiRestore: string;
  aiUse: string;
  aiSave: string;
  aiClose: string;
  aiSavePending: string;
  aiSaveError: string;
  actionSaved: string;
  actionDeleted: string;
  actionDuplicated: string;
  errorLabels: Record<string, string>;
}

const initialAiState: ComposerActionState<{
  subject: string;
  body: string;
  rationale?: string;
  traceId?: string;
}> = { ok: false };

export function TemplateWorkspaceClient({
  data,
  locale,
  labels,
}: {
  data: OutreachComposerData;
  locale: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState<LocaleFilter>("all");
  const [templateId, setTemplateId] = useState<string>(
    data.templates[0]?.id ?? ""
  );
  const activeTemplate = useMemo(
    () => data.templates.find((t) => t.id === templateId) ?? null,
    [data.templates, templateId]
  );

  const [draftName, setDraftName] = useState(activeTemplate?.name ?? "");
  const [draftSubject, setDraftSubject] = useState(activeTemplate?.subject ?? "");
  const [draftBody, setDraftBody] = useState(activeTemplate?.body ?? "");
  const [draftLocale, setDraftLocale] = useState<"en" | "zh">(
    (activeTemplate?.locale as "en" | "zh") ?? "en"
  );

  const [savePending, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicatePending, startDuplicate] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const [aiOpen, setAiOpen] = useState(false);
  const [aiState, setAiState] = useState(initialAiState);
  const [aiPending, startAi] = useTransition();
  const [aiEditedSubject, setAiEditedSubject] = useState("");
  const [aiEditedBody, setAiEditedBody] = useState("");
  const [aiSavePending, startAiSave] = useTransition();
  const [aiSaveError, setAiSaveError] = useState<string | null>(null);

  const selectableKols = useMemo(
    () => (data.selectedCampaign?.kols ?? []).filter((k) => !!k.email),
    [data.selectedCampaign]
  );

  const previewKol =
    selectableKols[0] ??
    data.selectedCampaign?.kols[0] ??
    null;

  const previewVars = useMemo(
    () => ({
      kol: {
        name: previewKol?.displayName ?? "GamerXia",
        handle: previewKol?.handle ?? "gamerxia",
      },
      product: {
        name: data.selectedCampaign?.productName ?? "Honor of Kings",
        category: data.selectedCampaign?.productCategory,
        usp: data.selectedCampaign?.productUsp,
      },
      marketer: { name: data.marketerName },
    }),
    [
      previewKol,
      data.marketerName,
      data.selectedCampaign?.productCategory,
      data.selectedCampaign?.productName,
      data.selectedCampaign?.productUsp,
    ]
  );

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.templates.filter((t) => {
      if (localeFilter !== "all" && t.locale !== localeFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)
      );
    });
  }, [data.templates, localeFilter, search]);

  const filteredSystemTemplates = filteredTemplates.filter(
    (t) => t.scope === "system"
  );
  const filteredUserTemplates = filteredTemplates.filter((t) => t.scope === "user");

  const preview = useMemo(
    () =>
      substituteSubjectAndBody(
        { subject: draftSubject, body: draftBody },
        previewVars
      ),
    [draftBody, draftSubject, previewVars]
  );
  const previewToAddress = previewKol?.email
    ? `${previewKol.displayName} <${previewKol.email}>`
    : "GamerXia <gamerxia@youtube.example>";

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const applyTemplate = (next: OutreachTemplateOption | null) => {
    setTemplateId(next?.id ?? "");
    setDraftName(next?.name ?? "");
    setDraftSubject(next?.subject ?? "");
    setDraftBody(next?.body ?? "");
    setDraftLocale((next?.locale as "en" | "zh") ?? "en");
    setSaveError(null);
    setAiSaveError(null);
  };

  const selectTemplate = (id: string) => {
    applyTemplate(data.templates.find((t) => t.id === id) ?? null);
  };

  const startNewTemplate = () => {
    setTemplateId("");
    setDraftName("Untitled template");
    setDraftSubject("");
    setDraftBody("");
    setDraftLocale(locale === "zh" ? "zh" : "en");
    setSaveError(null);
    setAiOpen(false);
    setAiState(initialAiState);
  };

  const saveDraft = () => {
    setSaveError(null);
    startSave(async () => {
      const fd = new FormData();
      if (activeTemplate?.scope === "user") {
        fd.set("templateId", activeTemplate.id);
      }
      fd.set("name", draftName || "Untitled template");
      fd.set("subject", draftSubject);
      fd.set("body", draftBody);
      fd.set("locale", draftLocale);
      fd.set(
        "variables",
        JSON.stringify((activeTemplate as OutreachTemplateOption | null)?.variables ?? [])
      );
      if (activeTemplate?.id) {
        fd.set("sourceTemplateId", activeTemplate.id);
      }
      const result = await saveTemplateAction({ ok: false }, fd);
      if (!result.ok || !result.data) {
        setSaveError(result.error ?? "generic");
        return;
      }
      applyTemplate(result.data);
      router.refresh();
    });
  };
  const saveLabel =
    activeTemplate?.scope === "user"
      ? labels.saveTemplate
      : labels.saveTemplateAs;

  const duplicateCurrent = () => {
    if (!activeTemplate) return;
    startDuplicate(async () => {
      const fd = new FormData();
      fd.set("templateId", activeTemplate.id);
      const result = await duplicateTemplateAction({ ok: false }, fd);
      if (!result.ok || !result.data) return;
      applyTemplate(result.data);
      router.refresh();
    });
  };

  const deleteCurrent = () => {
    if (!activeTemplate || activeTemplate.scope !== "user") return;
    startDelete(async () => {
      const fd = new FormData();
      fd.set("templateId", activeTemplate.id);
      const result = await deleteTemplateAction({ ok: false }, fd);
      if (!result.ok) return;
      startNewTemplate();
      router.refresh();
    });
  };

  const runCustomize = () => {
    if (!activeTemplate || !data.selectedCampaign || !previewKol) return;
    setAiState({ ok: false });
    setAiOpen(true);
    startAi(async () => {
      const fd = new FormData();
      fd.set("campaignId", data.selectedCampaign!.id);
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

  const saveAiAsTemplate = () => {
    if (!activeTemplate) return;
    setAiSaveError(null);
    startAiSave(async () => {
      const fd = new FormData();
      fd.set("name", `${draftName || activeTemplate.name} (AI)`);
      fd.set("subject", aiEditedSubject || draftSubject);
      fd.set("body", aiEditedBody || draftBody);
      fd.set("locale", draftLocale);
      fd.set(
        "variables",
        JSON.stringify((activeTemplate as OutreachTemplateOption).variables ?? [])
      );
      fd.set("sourceTemplateId", activeTemplate.id);
      const result = await saveTemplateAction({ ok: false }, fd);
      if (!result.ok || !result.data) {
        setAiSaveError(result.error ?? "generic");
        return;
      }
      applyTemplate(result.data);
      setAiOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="mb-3 text-xs text-outline">
        <span>{labels.breadcrumbRoot}</span>
        <span className="mx-2 text-outline-variant">/</span>
        <span>{labels.breadcrumbSection}</span>
        <span className="mx-2 text-outline-variant">/</span>
        <span className="text-primary-container">{draftName || labels.draft}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-[-0.02em] text-white">
              {draftName || labels.title}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">{labels.subtitle}</p>
          </div>
          <span className="rounded bg-tertiary-container/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-tertiary-container">
            {activeTemplate?.scope === "system" ? labels.systemTemplates : labels.draft}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={startNewTemplate}>
            {labels.newTemplate}
          </Button>
          <Button variant="ghost" size="sm" onClick={saveDraft} disabled={savePending}>
            {savePending ? labels.aiSavePending : saveLabel}
          </Button>
          <Button variant="secondary" size="sm" onClick={duplicateCurrent} disabled={duplicatePending || !activeTemplate}>
            {duplicatePending ? labels.duplicateTemplate : labels.duplicateTemplate}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteCurrent}
            disabled={deletePending || activeTemplate?.scope !== "user"}
          >
            {labels.deleteTemplate}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-10">
        <div className="flex flex-col gap-6 lg:col-span-6">
          <section className="glass-panel rounded-2xl border border-cyan/15 p-6 shadow-[0_0_30px_rgba(0,229,255,0.05)]">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-[240px] flex-1 flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-outline">
                  {labels.templateLabel}
                </label>
                <Select
                  value={templateId}
                  onChange={(e) => selectTemplate(e.target.value)}
                >
                  <option value="">{labels.templatePlaceholder}</option>
                  {filteredSystemTemplates.length > 0 ? (
                    <optgroup label={labels.systemTemplates}>
                      {filteredSystemTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.locale})
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {filteredUserTemplates.length > 0 ? (
                    <optgroup label={labels.myTemplates}>
                      {filteredUserTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.locale})
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </Select>
              </div>
              <div className="flex min-w-[240px] flex-1 gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-outline">
                    {labels.searchPlaceholder}
                  </label>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={labels.searchPlaceholder}
                  />
                </div>
                <div className="w-[140px]">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-outline">
                    {labels.localeAll}
                  </label>
                  <Select
                    value={localeFilter}
                    onChange={(e) => setLocaleFilter(e.target.value as LocaleFilter)}
                  >
                    <option value="all">{labels.localeAll}</option>
                    <option value="en">{labels.localeEn}</option>
                    <option value="zh">{labels.localeZh}</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-outline">
                  {labels.nameLabel}
                </label>
                <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-outline">
                  Locale
                </label>
                <Select
                  value={draftLocale}
                  onChange={(e) => setDraftLocale(e.target.value as "en" | "zh")}
                >
                  <option value="en">{labels.localeEn}</option>
                  <option value="zh">{labels.localeZh}</option>
                </Select>
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-outline">
                {labels.subjectLabel}
              </label>
              <Input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} />
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-outline">
                  {labels.bodyLabel}
                </label>
                <Button variant="secondary" size="sm" onClick={runCustomize} disabled={!activeTemplate || aiPending}>
                  {aiPending ? labels.aiPending : labels.aiButton}
                </Button>
              </div>
              <Textarea
                ref={bodyRef}
                rows={18}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                className="min-h-[440px] font-mono text-sm leading-6"
              />
            </div>

            {saveError ? (
              <p className="mt-3 rounded border border-error/30 bg-error/10 px-3 py-2 text-sm text-error" role="alert">
                {labels.errorLabels[saveError] ?? labels.errorLabels.generic}
              </p>
            ) : null}
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <section className="rounded-2xl border border-white/5 bg-surface/30 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{labels.previewTitle}</h3>
                <p className="text-xs text-on-surface-variant">
                  {previewKol ? `as ${previewKol.displayName}` : "Preview"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => bodyRef.current?.focus()}>
                {labels.previewTitle}
              </Button>
            </div>
            <div className="rounded-xl border border-outline-variant/40 bg-white p-6 text-gray-700">
              <div className="mb-5 border-b border-gray-100 pb-4">
                <div className="mb-1 text-[13px] text-gray-500">
                  <span className="font-bold text-gray-800">From:</span> Sarah Chen &lt;marketer@kolquest.com&gt;
                </div>
                <div className="mb-2 text-[13px] text-gray-500">
                  <span className="font-bold text-gray-800">To:</span>{" "}
                  {previewToAddress}
                </div>
                <div className="text-[14px] font-bold text-gray-900">{preview.subject}</div>
              </div>
              <div className="prose prose-sm max-w-none prose-p:my-4 prose-p:leading-7">
                <TemplateBodyMarkdown body={preview.body} />
              </div>
              <div className="mt-8 border-t border-gray-100 pt-6">
                <p className="text-center text-[11px] italic text-gray-400">
                  Lightning Games, 123 Tech Blvd, San Francisco, CA<br />
                  <a className="underline" href="#">
                    Unsubscribe
                  </a>{" "}
                  from this campaign
                </p>
              </div>
            </div>
          </section>

          <section className="p-5 rounded-2xl bg-primary-container/5 border border-primary-container/20">
            <h4 className="mb-1 text-sm font-bold text-primary-container">
              {labels.aiSave}
            </h4>
            <p className="text-xs leading-relaxed text-on-surface-variant">
              Use the editor to refine a template, then save it as a tenant-scoped user template. System templates stay read-only.
            </p>
          </section>
        </div>
      </div>

      <AiCustomizeDialog
        open={aiOpen}
        pending={aiPending}
        state={aiState}
        originalSubject={draftSubject}
        originalBody={draftBody}
        editedSubject={aiEditedSubject}
        editedBody={aiEditedBody}
        onEditedSubject={setAiEditedSubject}
        onEditedBody={setAiEditedBody}
        onAccept={() => {
          setDraftSubject(aiEditedSubject);
          setDraftBody(aiEditedBody);
          setAiOpen(false);
        }}
        onSaveAsTemplate={saveAiAsTemplate}
        onRestore={() => setAiOpen(false)}
        onClose={() => setAiOpen(false)}
        pendingSave={aiSavePending}
        saveError={aiSaveError}
        labels={labels}
      />
    </>
  );
}

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
  pendingSave,
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
  pendingSave: boolean;
  saveError: string | null;
  labels: Labels;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPanel size="lg" data-testid="outreach-ai-customize-dialog">
          <DialogHeader>
            <DialogTitle>{labels.aiTitle}</DialogTitle>
            <button
              type="button"
              aria-label={labels.aiClose}
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
                {labels.aiOriginal}
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
                <span className="material-symbols-outlined text-[14px]" aria-hidden>
                  auto_awesome
                </span>
                {labels.aiRewritten}
              </p>
              {pending ? (
                <p className="text-xs text-on-surface-variant">{labels.aiPending}</p>
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
                  <p className="text-xs text-on-surface-variant">
                    {state.data?.rationale ?? null}
                  </p>
                </div>
              ) : state.error ? (
                <p role="alert" className="rounded border border-error/30 bg-error/10 px-2 py-1 text-xs text-error">
                  {labels.errorLabels[state.error] ?? labels.errorLabels.generic}
                </p>
              ) : (
                <p className="text-xs text-on-surface-variant">—</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={onRestore}>
              {labels.aiRestore}
            </Button>
            <Button variant="secondary" size="sm" onClick={onSaveAsTemplate} disabled={!state.ok || pending || pendingSave}>
              {pendingSave ? labels.aiSavePending : labels.aiSave}
            </Button>
            <Button variant="primary-gradient" size="sm" disabled={!state.ok || pending} onClick={onAccept}>
              {labels.aiUse}
            </Button>
          </DialogFooter>
          {saveError ? (
            <p className="px-5 pb-4 text-xs text-error" role="alert">
              {labels.errorLabels[saveError] ?? labels.aiSaveError}
            </p>
          ) : null}
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}
