import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GradientButton } from "../GradientButton";

describe("GradientButton", () => {
  it("renders children and fires onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<GradientButton onClick={onClick}>New Campaign</GradientButton>);
    const btn = screen.getByRole("button", { name: "New Campaign" });
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables and swaps label for a spinner while loading", () => {
    render(<GradientButton loading>New Campaign</GradientButton>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    // loading state hides the label text and shows the spinner icon
    expect(btn.textContent?.trim()).toBe("progress_activity");
  });

  it("renders an icon on the requested side", () => {
    render(
      <GradientButton icon={<span data-testid="icon">*</span>} iconPosition="right">
        Continue
      </GradientButton>
    );
    const btn = screen.getByRole("button");
    const icon = screen.getByTestId("icon");
    // Icon must sit to the right of the label in DOM order.
    expect(btn.lastElementChild?.contains(icon)).toBe(true);
  });
});
