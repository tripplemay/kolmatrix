import type { Prisma } from "@prisma/client";

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

export async function loadOutreachTemplates(
  tx: Prisma.TransactionClient,
  tenantId: string,
  locale: "en" | "zh"
): Promise<EmailTemplateOption[]> {
  const [systemLocaleRows, userRows] = await Promise.all([
    tx.emailTemplate.findMany({
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
    }),
    tx.emailTemplate.findMany({
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
    }),
  ]);

  let systemRows = orderTemplates(systemLocaleRows as EmailTemplateRecord[]);
  if (systemRows.length === 0 && locale !== "en") {
    const fallbackRows = await tx.emailTemplate.findMany({
      where: { tenantId: null, locale: "en" },
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
    systemRows = orderTemplates(fallbackRows as EmailTemplateRecord[]);
  }

  return [...systemRows, ...orderTemplates(userRows as EmailTemplateRecord[])];
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
