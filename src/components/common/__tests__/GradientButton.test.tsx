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

  // BIx-mvp-polish-pass F002 — `href` prop semantics. Adding href turns
  // the button into a next/link <a>, but disabled / loading still
  // fall back to <button disabled> for a11y reasons (you can't make
  // an <a> non-interactive without breaking screen readers).
  it("renders a next/link <a> with the given href when interactive", () => {
    render(<GradientButton href="/en/campaigns/new">New Campaign</GradientButton>);
    const link = screen.getByRole("link", { name: /New Campaign/i });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/en/campaigns/new");
  });

  it("falls back to <button disabled> when href + disabled are both set", () => {
    render(
      <GradientButton href="/en/campaigns/new" disabled>
        New Campaign
      </GradientButton>
    );
    expect(screen.queryByRole("link")).toBeNull();
    const btn = screen.getByRole("button", { name: /New Campaign/i });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toBeDisabled();
  });

  it("falls back to <button disabled> when href + loading are both set", () => {
    render(
      <GradientButton href="/en/campaigns/new" loading>
        New Campaign
      </GradientButton>
    );
    expect(screen.queryByRole("link")).toBeNull();
    const btn = screen.getByRole("button");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toBeDisabled();
  });
});
