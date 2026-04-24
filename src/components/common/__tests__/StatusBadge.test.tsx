import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("renders the provided label text", () => {
    render(<StatusBadge domain="campaign" status="active" label="Active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("picks the cyan tone for campaign active", () => {
    render(<StatusBadge domain="campaign" status="active" label="Active" />);
    expect(screen.getByTestId("status-badge").className).toContain("text-cyan");
  });

  it("picks the emerald tone for campaign completed", () => {
    render(
      <StatusBadge domain="campaign" status="completed" label="Completed" />
    );
    expect(screen.getByTestId("status-badge").className).toContain(
      "text-emerald-300"
    );
  });

  it("falls back to neutral tone on unknown status", () => {
    render(
      <StatusBadge domain="campaign" status="ghost" label="Ghost" />
    );
    expect(screen.getByTestId("status-badge").className).toContain(
      "text-on-surface-variant"
    );
  });

  it("renders a pulse dot when pulse=true", () => {
    const { container } = render(
      <StatusBadge
        domain="campaign"
        status="active"
        label="Active"
        pulse
      />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("exposes data-domain + data-status for selectors", () => {
    render(
      <StatusBadge
        domain="kolCampaign"
        status="signed"
        label="Signed"
      />
    );
    const el = screen.getByTestId("status-badge");
    expect(el).toHaveAttribute("data-domain", "kolCampaign");
    expect(el).toHaveAttribute("data-status", "signed");
  });
});
