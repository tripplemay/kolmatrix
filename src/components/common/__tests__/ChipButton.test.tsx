import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChipButton } from "../ChipButton";

describe("ChipButton", () => {
  it("renders children text inside a button", () => {
    render(<ChipButton>MOBA</ChipButton>);
    expect(screen.getByRole("button", { name: /MOBA/ })).toBeInTheDocument();
  });

  it("sets data-pressed when pressed=true", () => {
    render(<ChipButton pressed>MOBA</ChipButton>);
    expect(screen.getByRole("button")).toHaveAttribute("data-pressed", "true");
  });

  it("renders an ×-glyph when removable=true", () => {
    render(<ChipButton removable>US</ChipButton>);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toContain("close");
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ChipButton onClick={onClick}>Clear</ChipButton>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
