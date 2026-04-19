import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GhostButton } from "../GhostButton";

describe("GhostButton", () => {
  it("renders label and fires onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<GhostButton onClick={onClick}>View All</GhostButton>);
    await user.click(screen.getByRole("button", { name: /View All/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("honours disabled and does not fire onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <GhostButton disabled onClick={onClick}>
        Clear
      </GhostButton>
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
