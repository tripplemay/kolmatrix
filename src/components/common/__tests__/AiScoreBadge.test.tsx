import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AiScoreBadge } from "../AiScoreBadge";

describe("AiScoreBadge", () => {
  it("renders score text in circle variant by default", () => {
    const { container } = render(<AiScoreBadge score={87} />);
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(container.firstElementChild?.getAttribute("aria-label")).toBe("AI match score 87");
  });

  it("inline variant strips background classes", () => {
    const { container } = render(<AiScoreBadge score={55} variant="inline" />);
    const node = container.firstElementChild as HTMLElement;
    expect(node.className).not.toContain("glass-panel");
    expect(node.className).toContain("text-brand-400");
  });

  it("honours ariaLabel override", () => {
    const { container } = render(
      <AiScoreBadge score={72} variant="pill" ariaLabel="Match score for gamerxia" />
    );
    expect(container.firstElementChild?.getAttribute("aria-label")).toBe(
      "Match score for gamerxia"
    );
  });
});
