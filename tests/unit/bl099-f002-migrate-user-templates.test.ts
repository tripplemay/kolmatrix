/**
 * BL-099-F002 · user-template migration unit specs (mock-tx layer).
 *
 * Covers the migration's correctness contract: variable sanitization,
 * dedup detection, and the idempotent skip / dry-run / execute paths.
 * createAsset + withTenant are mocked at the module boundary so we
 * assert the script's own logic without a Postgres container.
 */
import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createAssetMock = vi.fn();
const queryRawMock = vi.fn();
const mockTx = { $queryRaw: queryRawMock } as unknown as Prisma.TransactionClient;

vi.mock("@/lib/assets/mutations", () => ({
  createAsset: (...args: unknown[]) => createAssetMock(...args),
}));
vi.mock("@/lib/db", () => ({
  prisma: { tenant: { findMany: vi.fn() } },
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) => fn(mockTx),
}));

const { sanitizeVariables, migrateUserTemplate, findExistingAsset } = await import(
  "@/../scripts/bl099-f002-migrate-user-templates"
);

function freshStats() {
  return { tenantsScanned: 0, userTemplatesScanned: 0, created: 0, skipped: 0, failed: 0 };
}

const ET = {
  id: "aaaaaaaa-1111-1111-1111-111111111111",
  tenantId: "tenant-a",
  name: "My template",
  subject: "Hi {{kol.name}}",
  body: "Body",
  variables: [],
  locale: "en",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BL-099-F002 user-template migration", () => {
  describe("sanitizeVariables", () => {
    it("keeps well-formed { token, ... } entries", () => {
      expect(
        sanitizeVariables([
          { token: "kol.name", required: true },
          { token: "x", description: "d" },
        ])
      ).toEqual([
        { token: "kol.name", required: true },
        { token: "x", description: "d" },
      ]);
    });

    it("drops malformed entries (no token / empty token) and non-array input", () => {
      expect(sanitizeVariables([{ key: "kol.name" }, "nope", null, { token: "" }])).toEqual([]);
      expect(sanitizeVariables("[]" as unknown as never)).toEqual([]);
      expect(sanitizeVariables(null)).toEqual([]);
    });
  });

  describe("findExistingAsset", () => {
    it("returns the matched row when an Asset already represents the template", async () => {
      queryRawMock.mockResolvedValueOnce([{ id: "existing" }]);
      await expect(findExistingAsset(mockTx, ET)).resolves.toEqual({ id: "existing" });
    });

    it("returns null when no Asset matches", async () => {
      queryRawMock.mockResolvedValueOnce([]);
      await expect(findExistingAsset(mockTx, ET)).resolves.toBeNull();
    });
  });

  describe("migrateUserTemplate", () => {
    it("skips (dedup) and does not write when an Asset already exists — idempotent", async () => {
      queryRawMock.mockResolvedValueOnce([{ id: "existing" }]);
      const stats = freshStats();
      await migrateUserTemplate(ET, true, stats);
      expect(createAssetMock).not.toHaveBeenCalled();
      expect(stats.skipped).toBe(1);
      expect(stats.created).toBe(0);
    });

    it("dry-run counts a would-create without writing", async () => {
      queryRawMock.mockResolvedValueOnce([]);
      const stats = freshStats();
      await migrateUserTemplate(ET, false, stats);
      expect(createAssetMock).not.toHaveBeenCalled();
      expect(stats.created).toBe(1);
    });

    it("execute creates a published user_created email Asset with migration marker + sanitized variables", async () => {
      queryRawMock.mockResolvedValueOnce([]);
      const stats = freshStats();
      const et = { ...ET, variables: [{ token: "kol.name" }, { key: "bad" }] };

      await migrateUserTemplate(et, true, stats);

      expect(createAssetMock).toHaveBeenCalledWith(
        mockTx,
        "tenant-a",
        expect.objectContaining({
          type: "email",
          source: "user_created",
          status: "published",
          name: "My template",
          content: {
            subject: "Hi {{kol.name}}",
            body: "Body",
            locale: "en",
            variables: [{ token: "kol.name" }],
          },
          metadata: { migrated_from_email_template_id: et.id },
        })
      );
      expect(stats.created).toBe(1);
    });
  });
});
