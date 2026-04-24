import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../Button";

describe("Button", () => {
  it("renders a primary-gradient button by default", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: /Save/ });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("gradient-cta");
  });

  it("maps variant=ghost to the outlined ghost class", () => {
    render(<Button variant="ghost">Cancel</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("border-outline-variant");
  });

  it("maps variant=danger to the error-tone class", () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("text-error");
  });

  it("passes through pressed → data-pressed for chip toggles", () => {
    render(
      <Button variant="chip" pressed>
        MOBA
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-pressed")).toBe("true");
  });

  it("fires onClick and honours disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Button onClick={onClick}>OK</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <Button onClick={onClick} disabled>
        OK
      </Button>
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("defaults type to button so forms don't submit accidentally", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
