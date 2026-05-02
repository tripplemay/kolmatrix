import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssetCard } from "../AssetCard";

const baseAsset = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "aaaaaaaa-0000-0000-0000-000000000001",
  productId: "prod-1",
  productName: "Honor of Kings",
  type: "email" as const,
  name: "Welcome Email v1",
  source: "ai_generated" as const,
  status: "draft" as const,
  parentId: null,
  versionIndex: 1,
  totalVariants: 3,
  contentPreview: "Hi {{kol.name}}",
  updatedAt: new Date("2026-04-30T00:00:00Z"),
  createdAt: new Date("2026-04-30T00:00:00Z"),
};

describe("AssetCard", () => {
  it("renders title + product name + variant index + status dot", () => {
    render(<AssetCard asset={baseAsset} isSelected={false} onSelect={() => {}} />);
    expect(screen.getByText("Welcome Email v1")).toBeInTheDocument();
    expect(screen.getByText(/Honor of Kings/)).toBeInTheDocument();
    expect(screen.getByText("v1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Draft" })).toBeInTheDocument();
  });

  it("renders the AI badge only for ai_generated source", () => {
    const { rerender } = render(
      <AssetCard asset={baseAsset} isSelected={false} onSelect={() => {}} />
    );
    expect(screen.getByText("AI")).toBeInTheDocument();
    rerender(
      <AssetCard
        asset={{ ...baseAsset, source: "user_created" }}
        isSelected={false}
        onSelect={() => {}}
      />
    );
    expect(screen.queryByText("AI")).not.toBeInTheDocument();
  });

  it("invokes onSelect when the card is clicked", () => {
    const onSelect = vi.fn();
    render(<AssetCard asset={baseAsset} isSelected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Welcome Email v1/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("aria-pressed=true when isSelected", () => {
    render(<AssetCard asset={baseAsset} isSelected onSelect={() => {}} />);
    expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
  });

  it("renders 4 quick-action buttons when onQuickAction is provided", () => {
    render(
      <AssetCard
        asset={baseAsset}
        isSelected={false}
        onSelect={() => {}}
        onQuickAction={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("quick-action click does NOT bubble to onSelect (stopPropagation)", () => {
    const onSelect = vi.fn();
    const onQuickAction = vi.fn();
    render(
      <AssetCard
        asset={baseAsset}
        isSelected={false}
        onSelect={onSelect}
        onQuickAction={onQuickAction}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onQuickAction).toHaveBeenCalledWith("edit");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("relativeTime helper handles a few canonical buckets", () => {
    const now = Date.now();
    expect(AssetCard.relativeTime(new Date(now - 30_000))).toBe("just now");
    expect(AssetCard.relativeTime(new Date(now - 5 * 60_000))).toBe("5m ago");
    expect(AssetCard.relativeTime(new Date(now - 2 * 3_600_000))).toBe("2h ago");
    expect(AssetCard.relativeTime(new Date(now - 5 * 86_400_000))).toBe("5d ago");
  });
});
