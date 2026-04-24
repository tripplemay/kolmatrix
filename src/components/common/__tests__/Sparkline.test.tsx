import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sparkline } from "../Sparkline";

describe("Sparkline", () => {
  it("renders an svg with role=img + aria-label by default", () => {
    render(<Sparkline data={[1, 2, 3]} label="14d" />);
    expect(screen.getByRole("img", { name: /14d/ })).toBeInTheDocument();
  });

  it("renders polyline points for non-empty data", () => {
    const { container } = render(<Sparkline data={[0, 5, 10]} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    expect(polyline?.getAttribute("points")).toBeTruthy();
  });

  it("emits an empty placeholder svg for an empty series", () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.querySelector("polyline")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("respects width / height props in the viewBox", () => {
    const { container } = render(
      <Sparkline data={[1, 2]} width={200} height={60} />
    );
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      "0 0 200 60"
    );
  });
});
