import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { TopbarSearch } from "../TopbarSearch";

describe("TopbarSearch", () => {
  it("renders the search input with the i18n placeholder", () => {
    renderIntl(<TopbarSearch />);
    expect(screen.getByPlaceholderText(/Search KOLs/)).toBeInTheDocument();
  });

  it("accepts an explicit placeholder override", () => {
    renderIntl(<TopbarSearch placeholder="Find a campaign" />);
    expect(screen.getByPlaceholderText("Find a campaign")).toBeInTheDocument();
  });

  it("focuses the input when Cmd/Ctrl+K is pressed globally", () => {
    renderIntl(<TopbarSearch />);
    const input = screen.getByPlaceholderText(/Search KOLs/) as HTMLInputElement;
    input.blur();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });
});
