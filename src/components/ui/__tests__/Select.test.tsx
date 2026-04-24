import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select } from "../Select";

describe("Select", () => {
  it("renders a native select with its options", () => {
    render(
      <Select aria-label="status">
        <option value="">—</option>
        <option value="draft">Draft</option>
        <option value="active">Active</option>
      </Select>
    );
    const el = screen.getByRole("combobox", { name: /status/ });
    expect(el.tagName).toBe("SELECT");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("fires onChange with the picked value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select aria-label="role" defaultValue="" onChange={onChange}>
        <option value="">—</option>
        <option value="admin">Admin</option>
      </Select>
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /role/ }),
      "admin"
    );
    expect(onChange).toHaveBeenCalled();
  });

  it("marks aria-invalid when invalid", () => {
    render(
      <Select aria-label="role" invalid defaultValue="">
        <option value="">—</option>
      </Select>
    );
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});
