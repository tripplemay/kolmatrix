import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "../Checkbox";

// BL-033-F001: keepMounted removed → Indicator renders nothing in unchecked-not-indeterminate.

describe("Checkbox", () => {
  it("defaults to unchecked and fires onCheckedChange on click", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Checkbox
        onCheckedChange={onCheckedChange}
        aria-label="Select row"
      />
    );
    const cb = screen.getByRole("checkbox", { name: /Select row/ });
    expect(cb).not.toBeChecked();
    await user.click(cb);
    // base-ui passes (checked, eventDetail); only assert on the first
    // arg so the test isn't coupled to the event-object shape.
    expect(onCheckedChange).toHaveBeenCalled();
    expect(onCheckedChange.mock.calls[0]![0]).toBe(true);
  });

  it("marks data-indeterminate when indeterminate is set", () => {
    render(
      <Checkbox indeterminate aria-label="Select all" />
    );
    expect(
      screen.getByRole("checkbox", { name: /Select all/ })
    ).toHaveAttribute("data-indeterminate", "true");
  });

  it("renders the dash glyph under indeterminate state", () => {
    const { container } = render(
      <Checkbox indeterminate aria-label="mixed" />
    );
    // Material icon rendered inside the indicator.
    expect(container.textContent).toContain("remove");
  });

  it("renders the check glyph in a normal state", () => {
    const { container } = render(
      <Checkbox defaultChecked aria-label="checked" />
    );
    expect(container.textContent).toContain("check");
  });

  it("renders no glyph when unchecked-not-indeterminate", () => {
    const { container } = render(
      <Checkbox aria-label="empty box" />
    );
    expect(container.textContent).not.toContain("check");
    expect(container.textContent).not.toContain("remove");
  });

  it("removes glyph when transitioning checked→unchecked", () => {
    const { container, rerender } = render(
      <Checkbox checked aria-label="toggling" />
    );
    expect(container.textContent).toContain("check");
    rerender(<Checkbox checked={false} aria-label="toggling" />);
    expect(container.textContent).not.toContain("check");
    expect(container.textContent).not.toContain("remove");
  });

  it("honours disabled and drops the onChange", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Checkbox
        disabled
        onCheckedChange={onCheckedChange}
        aria-label="disabled box"
      />
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
