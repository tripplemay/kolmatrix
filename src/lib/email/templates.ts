import type { Prisma } from "@prisma/client";

import { createAsset, deleteAsset, updateAsset } from "@/lib/assets/mutations";
import { loadAssetsForComposer } from "@/lib/assets/queries";
import type { AssetDetail } from "@/lib/assets/types";

export type EmailTemplateScope = "system" | "user";

export interface EmailTemplateRecord {
  id: string;
  tenantId: string | null;
  name: string;
  subject: string;
  body: string;
  variables: Prisma.JsonValue;
  locale: string;
  type: string;
  /** BL-026-F005 — productId/productName flow through from the
   * underlying asset row so the /outreach composer can offer a
   * Product filter Combobox without re-querying. Legacy email_template
   * loaders (loadUserTemplates / loadSystemTemplates) leave these
   * null — they don't carry product attachment in the legacy schema. */
  productId?: string | null;
  productName?: string | null;
}

// BL-035-F011 (CQ-H2): legacy `loadUserTemplates` / `loadSystemTemplates`
// removed — every composer caller now goes through `loadOutreachTemplates`
// which sources from the unified `asset` table. BL-099-F005: the
// email_template dual-write/mirror was removed and the table dropped;
// Asset is the single source of truth.

// BL-099-F001 — adapt an Asset write result (createAsset / updateAsset)
// back to the EmailTemplateOption shape callers expect, so the write
// path moves to the unified Asset table without changing any public
// signature. Same content-JSONB extraction口径 as loadAssetsForComposer.
function assetDetailToOption(detail: AssetDetail, tenantId: string): EmailTemplateOption {
  const c = (detail.content ?? {}) as Record<string, unknown>;
  const scope: EmailTemplateScope = detail.source === "system_seed" ? "system" : "user";
  return {
    id: detail.id,
    tenantId: scope === "system" ? null : tenantId,
    name: detail.name,
    subject: typeof c.subject === "string" ? c.subject : "",
    body: typeof c.body === "string" ? c.body : "",
    variables: (c.variables as Prisma.JsonValue) ?? [],
    locale: typeof c.locale === "string" ? c.locale : "en",
    type: scope,
    scope,
    productId: detail.productId,
    productName: detail.productName,
  };
}

export interface EmailTemplateOption extends EmailTemplateRecord {
  scope: EmailTemplateScope;
}

export interface EmailTemplateDraftInput {
  name: string;
  subject: string;
  body: string;
  variables: Prisma.InputJsonValue;
  locale: "en" | "zh";
}

/**
 * BL-025-F006 — composer reader sources from the unified `asset`
 * table (loadAssetsForComposer). BL-099-F005: the email_template
 * mirror was removed and the table dropped; Asset is the single
 * source of truth and email_log snapshots template_name (F003).
 *
 * Adapter shape: AssetSource → EmailTemplateScope mapping. Anything
 * with `tenantId IS NULL` (system_seed) is "system"; everything
 * else is "user". The composer dropdown UI uses scope to label
 * options, so the system / user split must round-trip through this
 * helper.
 *
 * Locale fallback (zh → en when no zh system_seed exists) is kept
 * to mirror the original behaviour: marketers running zh see
 * English fallback templates rather than empty UI.
 */
export async function loadOutreachTemplates(
  tx: Prisma.TransactionClient,
  tenantId: string,
  locale: "en" | "zh"
): Promise<EmailTemplateOption[]> {
  const primary = await loadAssetsForComposer(tx, "email", locale);

  let systemRows = primary.filter((row) => row.source === "system_seed");
  const userRows = primary.filter((row) => row.source !== "system_seed");

  if (systemRows.length === 0 && locale !== "en") {
    const fallback = await loadAssetsForComposer(tx, "email", "en");
    systemRows = fallback.filter((row) => row.source === "system_seed");
  }

  // Preserve the original loadOutreachTemplates ordering so the
  // composer dropdown looks identical to the pre-F006 baseline:
  //   - system rows sorted by createdAt asc (insertion order ⇒
  //     deterministic alphabetical-by-seed-script)
  //   - user rows sorted by createdAt desc (newest authoring first)
  systemRows = [...systemRows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  const userRowsSorted = [...userRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  function adapt(row: (typeof primary)[number]): EmailTemplateOption {
    const scope: EmailTemplateScope = row.source === "system_seed" ? "system" : "user";
    return {
      id: row.id,
      tenantId: scope === "system" ? null : tenantId,
      name: row.name,
      subject: row.subject,
      body: row.body,
      variables: row.variables,
      locale: row.locale,
      type: scope,
      scope,
      productId: row.productId,
      productName: row.productName,
    };
  }

  return [...systemRows.map(adapt), ...userRowsSorted.map(adapt)];
}

// BL-099-F001 — tenant's user-template count for the /reach templates
// tab badge, now counting Asset rows so it matches the composer /
// workspace list (loadOutreachTemplates reads published Assets).
// source=system_seed excluded (canonical library, not user-authored);
// status=published only so the badge equals the visible "My templates"
// list. RLS (withTenant tx) scopes to the tenant.
export async function countUserTemplates(
  tx: Prisma.TransactionClient
): Promise<number> {
  return tx.asset.count({
    where: { type: "email", source: { not: "system_seed" }, status: "published" },
  });
}

export async function createUserTemplate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: EmailTemplateDraftInput
): Promise<EmailTemplateOption> {
  // BL-099-F001 — write to the unified Asset table. status=published
  // so the template shows up in the composer dropdown + workspace list
  // immediately — the "止活血" fix: pre-BL-099 the write only hit
  // email_template, so user templates vanished from the Asset-sourced
  // list right after saving. (F005 dropped email_template entirely.)
  const detail = await createAsset(tx, tenantId, {
    type: "email",
    name: input.name,
    content: {
      subject: input.subject,
      body: input.body,
      locale: input.locale,
      variables: input.variables,
    },
    source: "user_created",
    status: "published",
  });
  return assetDetailToOption(detail, tenantId);
}

export async function updateUserTemplate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  templateId: string,
  input: EmailTemplateDraftInput
): Promise<EmailTemplateOption | null> {
  // Only the tenant's own user templates are editable; system_seed rows
  // are the canonical library and must not be mutated here. RLS already
  // scopes visibility to the tenant (+ system seeds); the source filter
  // rejects attempts to edit a seed. Non-existent / cross-tenant /
  // system → null (caller maps to not_found, never 500).
  const existing = await tx.asset.findFirst({
    where: { id: templateId, type: "email", source: { not: "system_seed" } },
    select: { id: true },
  });
  if (!existing) return null;

  const detail = await updateAsset(tx, templateId, {
    name: input.name,
    content: {
      subject: input.subject,
      body: input.body,
      locale: input.locale,
      variables: input.variables,
    },
  });
  return assetDetailToOption(detail, tenantId);
}

export async function deleteUserTemplate(
  tx: Prisma.TransactionClient,
  _tenantId: string,
  templateId: string
): Promise<boolean> {
  // Same guard as updateUserTemplate: only delete the tenant's own
  // user templates, never a system seed. RLS scopes visibility.
  const existing = await tx.asset.findFirst({
    where: { id: templateId, type: "email", source: { not: "system_seed" } },
    select: { id: true },
  });
  if (!existing) return false;

  return deleteAsset(tx, templateId);
}

export async function duplicateUserTemplate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  templateId: string
): Promise<EmailTemplateOption | null> {
  // Source can be any visible email template (own user template OR a
  // system seed) — RLS scopes visibility. The copy is always a fresh
  // user_created, published Asset owned by the tenant.
  const source = (await tx.asset.findFirst({
    where: { id: templateId, type: "email" },
    select: { name: true, content: true },
  })) as { name: string; content: Prisma.JsonValue } | null;
  if (!source) return null;

  const c = (source.content ?? {}) as Record<string, unknown>;
  const detail = await createAsset(tx, tenantId, {
    type: "email",
    name: `${source.name} Copy`,
    content: {
      subject: typeof c.subject === "string" ? c.subject : "",
      body: typeof c.body === "string" ? c.body : "",
      locale: typeof c.locale === "string" ? c.locale : "en",
      variables: (c.variables as Prisma.InputJsonValue) ?? [],
    },
    source: "user_created",
    status: "published",
  });
  return assetDetailToOption(detail, tenantId);
}
