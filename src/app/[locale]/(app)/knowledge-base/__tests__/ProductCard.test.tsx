/**
 * BL-025-F007 · ProductCard 4-state spec + chip-link rendering.
 *
 * Confirms the chip rows behave correctly across the four
 * aiAssets state buckets the spec calls out and that the ready-state
 * email/video chips become next/link anchors pointing at /assets
 * with the right query string. The actions module is mocked so the
 * test never reaches the server action layer.
 */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  triggerAiGeneration: vi.fn().mockResolvedValue({ ok: true }),
}));

import { ProductCard } from "../ProductCard";
import type { ProductListItem } from "../types";

const messages = {
  knowledgeBase: {
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

function renderCard(product: ProductListItem) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProductCard product={product} onEdit={() => {}} onDelete={() => {}} />
    </NextIntlClientProvider>
  );
}

const baseProduct: ProductListItem = {
  id: "cmab12cd30001g8l5h3n2q9rs",
  name: "Honor of Kings",
  category: "MOBA",
  targetAudience: "Mobile gamers",
  uniqueSellingPoints: "Daily tournaments",
  downloadUrl: "https://example.com/download",
  launchDate: null,
  aiAssets: null,
  createdAt: new Date("2026-04-30T00:00:00Z").toISOString(),
  updatedAt: new Date("2026-04-30T00:00:00Z").toISOString(),
};

describe("ProductCard 4 states", () => {
  it("null aiAssets → 'No assets yet' + Generate CTA visible", () => {
    renderCard({ ...baseProduct, aiAssets: null });
    expect(screen.getByText(/No assets yet/)).toBeInTheDocument();
    expect(screen.getByText(/Generate AI assets/)).toBeInTheDocument();
  });

  it("pending aiAssets → 'Generating assets…' chip + no Generate CTA", () => {
    renderCard({
      ...baseProduct,
      aiAssets: { status: "pending", requestedAt: new Date().toISOString() },
    });
    expect(screen.getByText(/Generating assets/)).toBeInTheDocument();
    expect(screen.queryByText(/Generate AI assets/)).not.toBeInTheDocument();
  });

  it("failed aiAssets → 'Generation failed' chip + Retry CTA", () => {
    renderCard({
      ...baseProduct,
      aiAssets: {
        status: "failed",
        error: "503",
        failedAt: new Date().toISOString(),
      },
    });
    expect(screen.getByText(/Generation failed/)).toBeInTheDocument();
    expect(screen.getByText(/Retry AI generation/)).toBeInTheDocument();
  });

  it("ready aiAssets → email + video chips render as Links to /assets with productId + types", () => {
    renderCard({
      ...baseProduct,
      aiAssets: {
        status: "ready",
        emailTemplates: [
          { subject: "S1", body: "B1" },
          { subject: "S2", body: "B2" },
          { subject: "S3", body: "B3" },
        ],
        videoScripts: [
          { title: "V1", script: "X" },
          { title: "V2", script: "Y" },
        ],
        generatedAt: new Date().toISOString(),
      },
    });
    const emailLink = screen.getByRole("link", { name: /3 email templates/i });
    expect(emailLink).toHaveAttribute(
      "href",
      `/en/assets?productId=${baseProduct.id}&types=email`
    );
    const videoLink = screen.getByRole("link", { name: /2 video scripts/i });
    expect(videoLink).toHaveAttribute(
      "href",
      `/en/assets?productId=${baseProduct.id}&types=video_script`
    );
  });
});
