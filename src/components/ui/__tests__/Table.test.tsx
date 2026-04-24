import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TBody, THead, TRow, Table, TCell } from "../Table";

describe("Table composite", () => {
  it("renders the full composition", () => {
    render(
      <Table data-testid="t">
        <THead>
          <TRow interactive={false}>
            <TCell as="th">Name</TCell>
            <TCell as="th" align="right">
              Value
            </TCell>
          </TRow>
        </THead>
        <TBody>
          <TRow>
            <TCell>Campaign A</TCell>
            <TCell align="right" numeric>
              $1,000
            </TCell>
          </TRow>
        </TBody>
      </Table>
    );
    expect(screen.getByTestId("t").tagName).toBe("TABLE");
    expect(screen.getByText("Campaign A")).toBeInTheDocument();
    expect(screen.getByText("$1,000").className).toContain("tabular-nums");
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  it("applies stickyHeader class on the container when requested", () => {
    const { container } = render(
      <Table stickyHeader>
        <TBody>
          <TRow>
            <TCell>x</TCell>
          </TRow>
        </TBody>
      </Table>
    );
    // The outer wrapper carries the overflow-y-auto scroll container.
    expect(container.firstChild).toHaveClass("max-h-[70vh]");
  });

  it("TRow with interactive=false drops the hover class", () => {
    const { container } = render(
      <Table>
        <TBody>
          <TRow interactive={false} data-testid="static">
            <TCell>x</TCell>
          </TRow>
        </TBody>
      </Table>
    );
    const tr = container.querySelector('[data-testid="static"]');
    expect(tr?.className).not.toContain("hover:bg-white");
  });
});
