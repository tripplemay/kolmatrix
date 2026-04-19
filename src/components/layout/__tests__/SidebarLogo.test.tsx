import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SidebarLogo } from "../SidebarLogo";

describe("SidebarLogo", () => {
  it("renders the KOLMatrix wordmark and tagline", () => {
    render(<SidebarLogo />);
    expect(screen.getByText("KOLMatrix")).toBeInTheDocument();
    expect(screen.getByText("Neural Velocity")).toBeInTheDocument();
  });

  it("renders the K monogram tile", () => {
    const { container } = render(<SidebarLogo />);
    expect(container.textContent).toContain("K");
  });
});
