import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GlassPanel } from "../GlassPanel";

describe("GlassPanel", () => {
  it("renders children inside a glass container", () => {
    render(
      <GlassPanel>
        <p>panel body</p>
      </GlassPanel>
    );
    expect(screen.getByText("panel body")).toBeInTheDocument();
  });

  it("applies cyan border when tone=cyan + glow=true", () => {
    const { container } = render(
      <GlassPanel tone="cyan" glow>
        <span>x</span>
      </GlassPanel>
    );
    const panel = container.firstElementChild as HTMLElement;
    expect(panel.className).toContain("border-brand-500/20");
    expect(panel.className).toContain("shadow-hz-card");
  });

  it("switches padding scale when padding=sm", () => {
    const { container } = render(
      <GlassPanel padding="sm">
        <span>x</span>
      </GlassPanel>
    );
    expect((container.firstElementChild as HTMLElement).className).toContain("p-4");
  });
});
