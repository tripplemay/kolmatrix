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
    // BIx-mvp-polish-pass F005-C: AvatarWithPlatformBadge now wraps
    // the source in `next/image`, which rewrites the rendered <img>
    // src to `/_next/image?url=<encoded>&w=...&q=...`. The original
    // URL is preserved inside the `url` query param.
    const { container } = render(
      <AvatarWithPlatformBadge name="g" src="https://cdn.test/a.png" alt="g" />
    );
    const img = container.querySelector("img");
    const src = img?.getAttribute("src") ?? "";
    expect(src).toMatch(/\/_next\/image/);
    const url = new URL(src, "http://localhost").searchParams.get("url");
    expect(url).toBe("https://cdn.test/a.png");
  });
});
