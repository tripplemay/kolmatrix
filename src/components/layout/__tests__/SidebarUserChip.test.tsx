import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SidebarUserChip } from "../SidebarUserChip";

describe("SidebarUserChip", () => {
  it("renders name and role", () => {
    render(<SidebarUserChip name="Sarah Chen" role="Marketer" />);
    expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
    expect(screen.getByText("Marketer")).toBeInTheDocument();
  });

  it("falls back to first letter when avatarUrl is missing", () => {
    render(<SidebarUserChip name="Mark Stone" role="Admin" />);
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("renders an <img> when avatarUrl is provided", () => {
    // BIx-mvp-polish-pass F005-C: SidebarUserChip now renders the
    // avatar via `next/image`, so the actual <img> src is the
    // `/_next/image?url=...&w=...&q=...` optimization endpoint. The
    // original URL is encoded into the `url` query param.
    const { container } = render(
      <SidebarUserChip name="X" role="Admin" avatarUrl="https://cdn.test/a.png" />
    );
    const src = container.querySelector("img")?.getAttribute("src") ?? "";
    expect(src).toMatch(/\/_next\/image/);
    const url = new URL(src, "http://localhost").searchParams.get("url");
    expect(url).toBe("https://cdn.test/a.png");
  });
});
