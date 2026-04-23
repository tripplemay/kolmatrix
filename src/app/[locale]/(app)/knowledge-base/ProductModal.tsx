"use client";

/**
 * BM1-F003 · Create-product modal.
 *
 * Mirrors Stitch knowledge-base.html §Modal overlay. uniqueSellingPoints
 * is cyan-starred + required — MVP PRD §13 Q5 enforces USP-strong products
 * so the AI asset generator has something to grip on. On successful save
 * the modal closes and the page re-fetches via revalidatePath().
 */
import { useTranslations } from "next-intl";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import { cn } from "@/lib/utils";
import { PRODUCT_PLATFORMS, type ProductPlatform } from "@/lib/products/schema";

import { createProduct } from "./actions";
import type { CreateProductState } from "@/lib/products/schema";

const initialState: CreateProductState = { ok: false };

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const UNDERLINE_INPUT =
  "w-full rounded-none border-0 border-b border-outline-variant bg-transparent px-0 pb-2 text-sm text-on-surface placeholder-slate-600 focus:border-cyan focus:outline-none focus:ring-0";
const BOXED_TEXTAREA =
  "w-full rounded-lg border border-outline-variant bg-transparent p-3 text-sm text-on-surface placeholder-slate-600 focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan";

export function ProductModal({ onClose, onCreated }: Props) {
  const t = useTranslations("knowledgeBase");
  const tErr = useTranslations("knowledgeBase.errors");
  const [state, formAction, pending] = useActionState(createProduct, initialState);
  const [platforms, setPlatforms] = useState<ProductPlatform[]>(["mobile"]);
  const [generate, setGenerate] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (state.ok) {
      onCreated();
      onClose();
    }
  }, [state.ok, onCreated, onClose]);

  useEffect(() => {
    const onKey = (e: WindowEventMap["keydown"]) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const togglePlatform = (p: ProductPlatform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const fieldErr = (name: keyof NonNullable<CreateProductState["fieldErrors"]>) =>
    state.fieldErrors?.[name] ? tErr(state.fieldErrors[name] as string) : null;

  const globalError =
    state.error === "generic"
      ? tErr("generic")
      : state.error === "unauthorized"
        ? tErr("generic")
        : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="product-modal"
    >
      <form
        ref={formRef}
        action={formAction}
        className="glass-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/5 shadow-2xl"
        noValidate
      >
        <div className="flex items-center justify-between border-b border-white/5 px-8 py-6">
          <h2 id={titleId} className="text-xl font-bold text-white">
            {t("modal.titleCreate")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("modal.close")}
            className="text-on-surface-variant hover:text-white"
          >
            <span className="material-symbols-outlined" aria-hidden>
              close
            </span>
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-8 py-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <FieldLabel
              label={t("modal.nameLabel")}
              required
              error={fieldErr("name")}
            >
              <input
                type="text"
                name="name"
                placeholder={t("modal.namePlaceholder")}
                required
                maxLength={200}
                className={UNDERLINE_INPUT}
                aria-invalid={Boolean(state.fieldErrors?.name)}
              />
            </FieldLabel>
            <FieldLabel
              label={t("modal.categoryLabel")}
              required
              error={fieldErr("category")}
            >
              <input
                type="text"
                name="category"
                placeholder={t("modal.categoryPlaceholder")}
                required
                maxLength={80}
                className={UNDERLINE_INPUT}
                aria-invalid={Boolean(state.fieldErrors?.category)}
              />
            </FieldLabel>
          </div>

          <div className="space-y-3">
            <LabelTag label={t("modal.platformLabel")} />
            <div className="flex flex-wrap gap-2">
              {PRODUCT_PLATFORMS.map((p) => {
                const active = platforms.includes(p);
                const labelKey =
                  `modal.platform${p.charAt(0).toUpperCase()}${p.slice(1)}` as const;
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-cyan bg-cyan/10 text-cyan font-semibold"
                        : "border-outline-variant text-on-surface-variant hover:border-cyan/50"
                    )}
                    aria-pressed={active}
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
            {platforms.map((p) => (
              <input key={p} type="hidden" name="platforms" value={p} />
            ))}
          </div>

          <FieldLabel label={t("modal.targetAudienceLabel")}>
            <textarea
              name="targetAudience"
              placeholder={t("modal.targetAudiencePlaceholder")}
              maxLength={2000}
              rows={3}
              className={cn(BOXED_TEXTAREA, "h-24")}
            />
          </FieldLabel>

          <FieldLabel
            label={t("modal.uspLabel")}
            required
            hint={t("modal.uspHelper")}
            error={fieldErr("uniqueSellingPoints")}
          >
            <textarea
              name="uniqueSellingPoints"
              placeholder={t("modal.uspPlaceholder")}
              required
              maxLength={4000}
              rows={3}
              className={cn(BOXED_TEXTAREA, "h-24")}
              aria-invalid={Boolean(state.fieldErrors?.uniqueSellingPoints)}
            />
          </FieldLabel>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <FieldLabel
              label={t("modal.downloadUrlLabel")}
              error={fieldErr("downloadUrl")}
            >
              <input
                type="url"
                name="downloadUrl"
                placeholder={t("modal.downloadUrlPlaceholder")}
                className={UNDERLINE_INPUT}
                aria-invalid={Boolean(state.fieldErrors?.downloadUrl)}
              />
            </FieldLabel>
            <FieldLabel
              label={t("modal.launchDateLabel")}
              error={fieldErr("launchDate")}
            >
              <input
                type="date"
                name="launchDate"
                className={cn(UNDERLINE_INPUT, "[color-scheme:dark]")}
                aria-invalid={Boolean(state.fieldErrors?.launchDate)}
              />
            </FieldLabel>
          </div>

          {globalError ? (
            <p className="text-sm text-rose-400" role="alert">
              {globalError}
            </p>
          ) : null}
          <p className="text-[11px] text-on-surface-variant/60">
            {t("modal.requiredNote")}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 bg-surface-lowest px-8 py-6">
          <label className="group flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name="generateImmediately"
              checked={generate}
              onChange={(e) => setGenerate(e.target.checked)}
              className="h-4 w-4 rounded border-outline-variant bg-surface-high text-cyan focus:ring-offset-background"
            />
            <span className="text-[13px] text-on-surface-variant transition-colors group-hover:text-on-surface">
              {t("modal.generateToggle")}
            </span>
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-white"
              disabled={pending}
            >
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="gradient-cta rounded-xl px-8 py-2.5 text-sm font-bold text-on-primary shadow-lg shadow-cyan/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? t("modal.submitting")
                : generate
                  ? t("modal.submit")
                  : t("modal.submitWithoutAi")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

interface FieldLabelProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
}

function LabelTag({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="text-[11px] font-bold uppercase tracking-wider text-cyan-fixed">
      {label}
      {required ? <span className="ml-1 text-cyan">*</span> : null}
    </label>
  );
}

function FieldLabel({ label, required, error, hint, children }: FieldLabelProps) {
  return (
    <div className="space-y-1.5">
      <LabelTag label={label} required={required} />
      {children}
      {hint && !error ? (
        <p className="text-[11px] text-on-surface-variant/70">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
