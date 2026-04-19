import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SecondaryButton } from "../SecondaryButton";

describe("SecondaryButton", () => {
  it("renders label", () => {
    render(<SecondaryButton>Add KOLs</SecondaryButton>);
    expect(screen.getByRole("button", { name: "Add KOLs" })).toBeInTheDocument();
  });

  it("applies tone-specific classes (purple)", () => {
    render(<SecondaryButton tone="purple">Flag</SecondaryButton>);
    const btn = screen.getByRole("button", { name: "Flag" });
    expect(btn.className).toContain("text-purple");
  });

  it("is disabled when disabled prop is set", () => {
    render(<SecondaryButton disabled>Idle</SecondaryButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
