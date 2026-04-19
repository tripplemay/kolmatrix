import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TagChip } from "../TagChip";

describe("TagChip", () => {
  it("renders the label text", () => {
    render(<TagChip label="Gaming" />);
    expect(screen.getByText("Gaming")).toBeInTheDocument();
  });

  it("applies tone-specific classes (cyan)", () => {
    const { container } = render(<TagChip label="AI" tone="cyan" />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.className).toContain("text-cyan");
  });

  it("forwards an optional icon before the label", () => {
    render(<TagChip label="FPS" icon={<span data-testid="icon">★</span>} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("FPS")).toBeInTheDocument();
  });
});
