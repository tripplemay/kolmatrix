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
    const { container } = render(
      <SidebarUserChip name="X" role="Admin" avatarUrl="https://cdn.test/a.png" />
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn.test/a.png");
  });
});
