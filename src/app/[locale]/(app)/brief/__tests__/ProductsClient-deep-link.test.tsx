/**
 * BL-069-F004 · ProductsClient deep-link auto-open behavior.
 *
 * Verifies the optional `initialEditingProductId` prop so
 * /brief?tab=products&productId=:id can land directly on the edit
 * modal for a specific product.
 *
 * 4 cases (spec acceptance ≥4):
 *   1. initialEditingProductId matches a product → modal opens on
 *      mount with that product's data prefilled (header shows the
 *      "edit" title flavour).
 *   2. initialEditingProductId is undefined → modal stays closed;
 *      full grid is rendered.
 *   3. initialEditingProductId points at an ID not in the products
 *      list → modal stays closed (silent fallback — no error toast,
 *      matches §5 不变量 #4 silent-fallback ethos used across BL-069).
 *   4. Explicit "Add new product" click still opens the modal in
 *      create mode (regression guard — verifies the deep-link path
 *      didn't shadow the existing onClick path).
 *
 * BL-070-F004 — the product CRUD components were git mv'd from
 * /knowledge-base into /brief, so this spec now imports from the
 * sibling `../` directly instead of cross-route `../../knowledge-base`.
 *
 * The product actions module is mocked so deleteProduct never reaches
 * the server action layer; mocking next/navigation's useRouter prevents
 * router.refresh() from blowing up in jsdom.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  deleteProduct: vi.fn().mockResolvedValue({ ok: true }),
  triggerAiGeneration: vi.fn().mockResolvedValue({ ok: true }),
  createProduct: vi.fn().mockResolvedValue({ ok: true }),
  updateProduct: vi.fn().mockResolvedValue({ ok: true }),
  loadProductAssetsAction: vi.fn().mockResolvedValue([]),
}));

import { ProductsClient } from "../ProductsClient";
import type { ProductListItem } from "../types";

const messages = {
  common: {
    emptyState: {
      noProducts: {
        title: "No products yet",
        description: "Register one to get started.",
        cta: "Add product",
      },
    },
  },
  knowledgeBase: {
    title: "Products",
    subtitle: "Manage your tenant products.",
    addButton: "Add new product",
    importCsv: "Import CSV",
    importCsvDisabled: "Coming soon",
    emptyCardLabel: "Add another",
    breadcrumbRoot: "Home",
    breadcrumbCurrent: "Products",
    delete: {
      confirm: "Delete {name}?",
      cascade: "{campaign} campaigns / {asset} assets / {kolCampaign} links?",
      failed: "Delete failed",
    },
    modal: {
      titleCreate: "New product",
      titleEdit: "Edit product",
      submitCreate: "Create",
      submitEdit: "Save",
      cancel: "Cancel",
    },
    errors: {
      generic: "Something went wrong.",
    },
    card: {
      lastUpdated: "Updated {date}",
      emailTemplates: "{count, plural, one {# email template} other {# email templates}}",
      videoScripts: "{count, plural, one {# video script} other {# video scripts}}",
      generating: "Generating assets…",
      generationFailed: "Generation failed",
      noAssetsYet: "No assets yet",
      generateAiCta: "Generate AI assets",
      generateAiRetry: "Retry AI generation",
      generateAiPending: "Calling…",
      generateAiError: "Could not start",
      editAction: "Edit product",
      deleteAction: "Delete product",
    },
  },
};

const PRODUCTS: ProductListItem[] = [
  {
    id: "cprod1111111111111111",
    name: "Genshin Impact",
    category: "mobile-game",
    targetAudience: "RPG fans",
    uniqueSellingPoints: "Open world fantasy",
    downloadUrl: null,
    launchDate: null,
    aiAssets: null,
    assetCounts: { emailCount: 0, videoCount: 0 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cprod2222222222222222",
    name: "Clash Royale",
    category: "mobile-game",
    targetAudience: "Strategy fans",
    uniqueSellingPoints: "Real-time PvP",
    downloadUrl: null,
    launchDate: null,
    aiAssets: null,
    assetCounts: { emailCount: 0, videoCount: 0 },
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

function renderClient(initialEditingProductId?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProductsClient
        products={PRODUCTS}
        initialEditingProductId={initialEditingProductId}
      />
    </NextIntlClientProvider>,
  );
}

describe("BL-069-F004 ProductsClient deep-link", () => {
  it("1. initialEditingProductId matches a product → edit modal opens with prefilled fields", () => {
    renderClient("cprod2222222222222222");
    // Modal is mounted; its heading is the "Edit product" string.
    const modal = screen.getByTestId("product-modal");
    expect(modal).toBeInTheDocument();
    // Product name field inside the modal is prefilled with the
    // matched product. getByDisplayValue scopes to inputs so it
    // doesn't collide with card body text.
    expect(screen.getByDisplayValue("Clash Royale")).toBeInTheDocument();
  });

  it("2. initialEditingProductId undefined (KB caller path) → modal stays closed, grid visible", () => {
    renderClient();
    // No modal mounted.
    expect(screen.queryByTestId("product-modal")).toBeNull();
    // Grid container is present + both products visible.
    expect(screen.getByTestId("kb-grid")).toBeInTheDocument();
    expect(screen.getByText("Genshin Impact")).toBeInTheDocument();
    expect(screen.getByText("Clash Royale")).toBeInTheDocument();
  });

  it("3. initialEditingProductId points at unknown id → modal stays closed (silent fallback)", () => {
    renderClient("cprod_UNKNOWN_NOT_IN_LIST");
    expect(screen.queryByTestId("product-modal")).toBeNull();
    // Grid still renders so users can still pick a product manually.
    expect(screen.getByTestId("kb-grid")).toBeInTheDocument();
  });

  it("4. explicit 'Add new product' click opens modal in create mode (regression guard)", () => {
    renderClient();
    expect(screen.queryByTestId("product-modal")).toBeNull();
    fireEvent.click(screen.getByTestId("kb-add-product"));
    // Modal now mounted in create flavour (no product prefilled).
    expect(screen.getByTestId("product-modal")).toBeInTheDocument();
    // No existing product input prefilled — Clash Royale must NOT
    // appear in any input.
    expect(screen.queryByDisplayValue("Clash Royale")).toBeNull();
  });
});
