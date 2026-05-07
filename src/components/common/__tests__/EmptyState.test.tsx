/**
 * BL-052 F006 — EmptyState contract.
 *
 * Three CTA shapes:
 *   1. No CTA           — informational tile, body only.
 *   2. CTA with href    — renders a <Link>; clicking navigates.
 *   3. CTA with onClick — renders a <button> wrapped around the same
 *                         label, clicking invokes the handler.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders icon, title, description without a CTA when cta prop is omitted", () => {
    render(
      <EmptyState
        icon="inventory_2"
        title="Nothing here"
        description="Add your first product to get started."
        testId="empty-products"
      />
    );
    expect(screen.getByTestId("empty-products")).toBeInTheDocument();
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(
      screen.getByText("Add your first product to get started.")
    ).toBeInTheDocument();
    expect(screen.getByText("inventory_2")).toBeInTheDocument();
    // No CTA — no button or link nodes inside the tile.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a <Link> when cta.href is set", () => {
    render(
      <EmptyState
        icon="groups"
        title="No KOLs"
        description="Discover creators."
        cta={{ label: "Open discovery", href: "/discovery" }}
        testId="empty-kols"
      />
    );
    const link = screen.getByRole("link", { name: "Open discovery" });
    expect(link).toHaveAttribute("href", "/discovery");
    expect(link).toHaveAttribute("data-testid", "empty-kols-cta");
  });

  it("renders a <button> wired to onClick when cta has only onClick", () => {
    const handler = vi.fn();
    render(
      <EmptyState
        icon="campaign"
        title="No campaigns"
        description="Start your first one."
        cta={{ label: "Create campaign", onClick: handler }}
        testId="empty-campaigns"
      />
    );
    const button = screen.getByRole("button", { name: "Create campaign" });
    expect(button).toHaveAttribute("data-testid", "empty-campaigns-cta");
    fireEvent.click(button);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
