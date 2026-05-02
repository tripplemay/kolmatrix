import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusDot } from "../StatusDot";

describe("StatusDot", () => {
  it("uses the amber tone for draft", () => {
    render(<StatusDot status="draft" />);
    const dot = screen.getByRole("img", { name: "Draft" });
    expect(dot.className).toContain("bg-amber-400");
  });

  it("uses the emerald tone for published", () => {
    render(<StatusDot status="published" />);
    const dot = screen.getByRole("img", { name: "Published" });
    expect(dot.className).toContain("bg-emerald-400");
  });

  it("uses the on-surface-variant tone for archived", () => {
    render(<StatusDot status="archived" />);
    const dot = screen.getByRole("img", { name: "Archived" });
    expect(dot.className).toContain("bg-on-surface-variant");
  });

  it("honours the ariaLabel override", () => {
    render(<StatusDot status="draft" ariaLabel="Custom label" />);
    expect(screen.getByRole("img", { name: "Custom label" })).toBeInTheDocument();
  });
});
