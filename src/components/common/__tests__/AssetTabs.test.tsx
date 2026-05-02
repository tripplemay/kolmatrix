import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssetTabs } from "../AssetTabs";

const TABS = [
  { id: "preview" as const, label: "Preview" },
  { id: "edit" as const, label: "Edit" },
  { id: "versions" as const, label: "Versions", disabled: true },
  { id: "used_in" as const, label: "Used in" },
];

describe("AssetTabs", () => {
  it("renders every tab and marks the active one with aria-selected", () => {
    render(<AssetTabs tabs={TABS} activeTab="preview" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Edit" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("invokes onChange with the clicked tab id", () => {
    const onChange = vi.fn();
    render(<AssetTabs tabs={TABS} activeTab="preview" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Edit" }));
    expect(onChange).toHaveBeenCalledWith("edit");
  });

  it("does not invoke onChange for disabled tabs", () => {
    const onChange = vi.fn();
    render(<AssetTabs tabs={TABS} activeTab="preview" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Versions" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ArrowRight cycles to the next enabled tab and skips disabled ones", () => {
    const onChange = vi.fn();
    render(<AssetTabs tabs={TABS} activeTab="edit" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Edit" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("used_in");
  });

  it("ArrowLeft from the first tab wraps to the last enabled tab", () => {
    const onChange = vi.fn();
    render(<AssetTabs tabs={TABS} activeTab="preview" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Preview" }), {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenCalledWith("used_in");
  });
});
