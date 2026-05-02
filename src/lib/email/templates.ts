import type { Prisma } from "@prisma/client";

import { loadAssetsForComposer } from "@/lib/assets/queries";

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

function toOption(row: EmailTemplateRecord): EmailTemplateOption {
  return {
    ...row,
    scope: row.tenantId == null ? "system" : "user",
  };
}

function orderTemplates(rows: EmailTemplateRecord[]): EmailTemplateOption[] {
  return rows.map(toOption);
}

/**
 * BL-025-F006 — composer reader now sources from the unified
 * `asset` table (loadAssetsForComposer). The legacy email_template
 * path remains for the dual-write window: every createAsset /
 * updateAsset on type=email mirrors into email_template so
 * email_log.template_id keeps pointing at a real row, and any
 * caller that still queries email_template directly still sees
 * fresh content.
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
    };
  }

  return [...systemRows.map(adapt), ...userRows.map(adapt)];
}

export async function loadUserTemplates(
  tx: Prisma.TransactionClient,
  tenantId: string,
  locale: "en" | "zh"
): Promise<EmailTemplateOption[]> {
  const rows = await tx.emailTemplate.findMany({
    where: { tenantId, type: "user", locale },
    select: {
      id: true,
      tenantId: true,
      name: true,
      subject: true,
      body: true,
      variables: true,
      locale: true,
      type: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return orderTemplates(rows as EmailTemplateRecord[]);
}

export async function loadSystemTemplates(
  tx: Prisma.TransactionClient,
  locale: "en" | "zh"
): Promise<EmailTemplateOption[]> {
  const rows = await tx.emailTemplate.findMany({
    where: { tenantId: null, locale },
    select: {
      id: true,
      tenantId: true,
      name: true,
      subject: true,
      body: true,
      variables: true,
      locale: true,
      type: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return orderTemplates(rows as EmailTemplateRecord[]);
}

export async function createUserTemplate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: EmailTemplateDraftInput
): Promise<EmailTemplateOption> {
  const row = await tx.emailTemplate.create({
    data: {
      tenantId,
      name: input.name,
      subject: input.subject,
      body: input.body,
      variables: input.variables,
      locale: input.locale,
      type: "user",
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
      subject: true,
      body: true,
      variables: true,
      locale: true,
      type: true,
    },
  });
  return toOption(row as EmailTemplateRecord);
}

export async function updateUserTemplate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  templateId: string,
  input: EmailTemplateDraftInput
): Promise<EmailTemplateOption | null> {
  const existing = await tx.emailTemplate.findFirst({
    where: { id: templateId, tenantId, type: "user" },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await tx.emailTemplate.update({
    where: { id: templateId },
    data: {
      name: input.name,
      subject: input.subject,
      body: input.body,
      variables: input.variables,
      locale: input.locale,
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
      subject: true,
      body: true,
      variables: true,
      locale: true,
      type: true,
    },
  });
  return toOption(row as EmailTemplateRecord);
}

export async function deleteUserTemplate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  templateId: string
): Promise<boolean> {
  const existing = await tx.emailTemplate.findFirst({
    where: { id: templateId, tenantId, type: "user" },
    select: { id: true },
  });
  if (!existing) return false;

  await tx.emailTemplate.delete({ where: { id: templateId } });
  return true;
}

export async function duplicateUserTemplate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  templateId: string
): Promise<EmailTemplateOption | null> {
  const existing = await tx.emailTemplate.findFirst({
    where: { id: templateId, OR: [{ tenantId }, { tenantId: null }] },
    select: {
      name: true,
      subject: true,
      body: true,
      variables: true,
      locale: true,
      type: true,
    },
  });
  if (!existing) return null;

  return createUserTemplate(tx, tenantId, {
    name: `${existing.name} Copy`,
    subject: existing.subject,
    body: existing.body,
    variables: existing.variables ?? [],
    locale: existing.locale as "en" | "zh",
  });
}
