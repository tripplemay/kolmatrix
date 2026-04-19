import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionHeader } from "../SectionHeader";

describe("SectionHeader", () => {
  it("renders title and subtitle", () => {
    render(<SectionHeader title="Active Campaigns" subtitle="Last 7 days" />);
    expect(screen.getByRole("heading", { name: "Active Campaigns" })).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
  });

  it("renders as the requested heading level", () => {
    render(<SectionHeader title="Page" as="h1" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Page");
  });

  it("renders actions slot when provided", () => {
    render(<SectionHeader title="x" actions={<button type="button">action-btn</button>} />);
    expect(screen.getByRole("button", { name: "action-btn" })).toBeInTheDocument();
  });
});
