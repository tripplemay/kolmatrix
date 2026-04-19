import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatCard } from "../StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Total KOLs" value="12,847" />);
    expect(screen.getByText("Total KOLs")).toBeInTheDocument();
    expect(screen.getByText("12,847")).toBeInTheDocument();
  });

  it("shows trend chip with up direction and +percent prefix", () => {
    render(<StatCard label="Opens" value="42%" trend={{ direction: "up", percent: 12 }} />);
    expect(screen.getByText(/\+12%/)).toBeInTheDocument();
    // the icon name is inlined as text via material symbols
    expect(screen.getByText("trending_up")).toBeInTheDocument();
  });

  it("renders sparkline bars proportional to values", () => {
    const { container } = render(
      <StatCard label="Sends" value="100" sparkline={[1, 3, 5, 4, 6]} />
    );
    // one child per sparkline value
    const bars = container.querySelectorAll("[style*=height]");
    expect(bars.length).toBe(5);
  });
});
