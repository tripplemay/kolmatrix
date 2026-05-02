import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  createUserTemplate,
  deleteUserTemplate,
  duplicateUserTemplate,
  loadOutreachTemplates,
  updateUserTemplate,
  type EmailTemplateDraftInput,
} from "../templates";

type TemplateRow = {
  id: string;
  tenantId: string | null;
  name: string;
  subject: string;
  body: string;
  variables: unknown;
  locale: "en" | "zh";
  type: string;
};

type TemplateTx = Prisma.TransactionClient & {
  emailTemplate: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  // BL-025-F006: loadOutreachTemplates now delegates to
  // loadAssetsForComposer which queries the unified asset table.
  asset: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

function makeRow(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    tenantId: null,
    name: "Base template",
    subject: "Hi {{kol.name}}",
    body: "Hello {{kol.handle}}",
    variables: [],
    locale: "en",
    type: "system",
    ...overrides,
  };
}

function makeTx(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  const tx = {
    emailTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
    },
  };
  Object.assign(tx.emailTemplate, overrides);
  return tx as TemplateTx;
}

function makeAssetRow(opts: {
  id?: string;
  name?: string;
  source?: "ai_generated" | "user_created" | "imported" | "system_seed";
  productId?: string | null;
  productName?: string | null;
  content?: { subject?: string; body?: string; locale?: string; variables?: unknown };
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const at = opts.createdAt ?? new Date("2026-04-30T00:00:00Z");
  return {
    id: opts.id ?? "11111111-1111-1111-1111-111111111111",
    name: opts.name ?? "Base template",
    source: opts.source ?? "system_seed",
    productId: opts.productId ?? null,
    product: opts.productName ? { name: opts.productName } : null,
    content: {
      subject: opts.content?.subject ?? "Hi {{kol.name}}",
      body: opts.content?.body ?? "Hello {{kol.handle}}",
      locale: opts.content?.locale ?? "en",
      variables: opts.content?.variables ?? [],
    },
    createdAt: at,
    updatedAt: opts.updatedAt ?? at,
  };
}

describe("email templates helpers", () => {
  it("loads system and user templates with locale fallback for system rows", async () => {
    const tx = makeTx();
    // First call (locale=zh): only the user row, no system seeds
    // available in zh.
    tx.asset.findMany
      .mockResolvedValueOnce([
        makeAssetRow({
          id: "user-1",
          name: "My Draft",
          source: "user_created",
          content: { subject: "Hi {{kol.name}}", body: "Body", locale: "zh", variables: [] },
        }),
      ])
      // Second call (locale=en fallback): one system seed in EN.
      .mockResolvedValueOnce([
        makeAssetRow({
          id: "sys-1",
          name: "Fallback EN",
          source: "system_seed",
          content: { subject: "Hi {{kol.name}}", body: "Body", locale: "en", variables: [] },
        }),
      ]);

    const result = await loadOutreachTemplates(tx, "tenant-a", "zh");

    expect(tx.asset.findMany).toHaveBeenCalledTimes(2);
    expect(result.map((r) => r.name)).toEqual(["Fallback EN", "My Draft"]);
    expect(result[0]?.scope).toBe("system");
    expect(result[1]?.scope).toBe("user");
  });

  it("creates, updates, deletes and duplicates user templates with tenant guards", async () => {
    const tx = makeTx();
    const draft: EmailTemplateDraftInput = {
      name: "Working draft",
      subject: "Hello",
      body: "Body",
      locale: "en",
      variables: [],
    };

    tx.emailTemplate.create
      .mockResolvedValueOnce(
        makeRow({
          id: "22222222-2222-2222-2222-222222222222",
          tenantId: "tenant-a",
          type: "user",
          name: draft.name,
          subject: draft.subject,
          body: draft.body,
          locale: draft.locale,
        })
      )
      .mockResolvedValueOnce(
        makeRow({
          id: "33333333-3333-3333-3333-333333333333",
          tenantId: "tenant-a",
          type: "user",
          name: "System base Copy",
          subject: "Hello {{kol.name}}",
          body: "Body {{product.name}}",
          locale: "zh",
        })
      );
    tx.emailTemplate.findFirst.mockResolvedValueOnce({ id: "template-1" });
    tx.emailTemplate.update.mockResolvedValue(makeRow({
      id: "template-1",
      tenantId: "tenant-a",
      type: "user",
      name: "Updated",
      subject: "Updated subject",
      body: "Updated body",
    }));
    tx.emailTemplate.delete.mockResolvedValue({ id: "template-1" });
    tx.emailTemplate.findFirst
      .mockResolvedValueOnce({ id: "template-1" })
      .mockResolvedValueOnce({ id: "template-1" })
      .mockResolvedValueOnce({
        name: "System base",
        subject: "Hello {{kol.name}}",
        body: "Body {{product.name}}",
        variables: [{ key: "kol.name" }],
        locale: "zh",
        type: "system",
      });

    const created = await createUserTemplate(tx, "tenant-a", draft);
    const updated = await updateUserTemplate(tx, "tenant-a", "template-1", draft);
    const deleted = await deleteUserTemplate(tx, "tenant-a", "template-1");
    const duplicated = await duplicateUserTemplate(tx, "tenant-a", "system-1");

    expect(created.scope).toBe("user");
    expect(created.id).toBe("22222222-2222-2222-2222-222222222222");
    expect(updated?.name).toBe("Updated");
    expect(deleted).toBe(true);
    expect(duplicated?.name).toBe("System base Copy");
    expect(duplicated?.locale).toBe("zh");
  });

  it("refuses to update or delete templates outside the current tenant", async () => {
    const tx = makeTx();
    tx.emailTemplate.findFirst.mockResolvedValue(null);

    await expect(updateUserTemplate(tx, "tenant-a", "template-x", {
      name: "x",
      subject: "x",
      body: "x",
      locale: "en",
      variables: [],
    })).resolves.toBeNull();

    await expect(deleteUserTemplate(tx, "tenant-a", "template-x")).resolves.toBe(false);
  });
});
