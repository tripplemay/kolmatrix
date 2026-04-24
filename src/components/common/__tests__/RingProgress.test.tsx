import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RingProgress } from "../RingProgress";

describe("RingProgress", () => {
  it("renders an svg with the centre label visible to assistive tech via aria-label fallback", () => {
    render(<RingProgress value={0.268} label="26.8%" />);
    expect(screen.getByText("26.8%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /26\.8%/ })).toBeInTheDocument();
  });

  it("clamps values above 1 to a full ring", () => {
    const { container } = render(<RingProgress value={2} />);
    const fg = container.querySelectorAll("circle")[1]!;
    expect(fg.getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("clamps negative values to an empty ring", () => {
    const { container } = render(<RingProgress value={-0.5} />);
    const fg = container.querySelectorAll("circle")[1]!;
    // Empty ring: dashoffset === circumference
    const dashArray = fg.getAttribute("stroke-dasharray")!;
    expect(fg.getAttribute("stroke-dashoffset")).toBe(dashArray);
  });

  it("uses a default ariaLabel reflecting the percent when no label given", () => {
    render(<RingProgress value={0.5} />);
    expect(screen.getByRole("img", { name: /50/ })).toBeInTheDocument();
  });
});
