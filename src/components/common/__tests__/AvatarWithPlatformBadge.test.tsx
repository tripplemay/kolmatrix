import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvatarWithPlatformBadge } from "../AvatarWithPlatformBadge";

describe("AvatarWithPlatformBadge", () => {
  it("shows the name initial fallback when no image provided", () => {
    render(<AvatarWithPlatformBadge name="Sarah Chen" />);
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("shows '?' when no name AND no image provided", () => {
    render(<AvatarWithPlatformBadge />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders platform badge (youtube) when platform is set", () => {
    render(<AvatarWithPlatformBadge name="g" platform="youtube" />);
    expect(screen.getByLabelText("youtube badge")).toBeInTheDocument();
  });

  it("renders an <img> when src is provided", () => {
    const { container } = render(
      <AvatarWithPlatformBadge name="g" src="https://cdn.test/a.png" alt="g" />
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.test/a.png");
  });
});
