import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldError, FieldHint, Input, Label, Textarea } from "../Input";

describe("Input", () => {
  it("renders a native input with the shared style", () => {
    render(<Input name="email" placeholder="you@example.test" />);
    const el = screen.getByPlaceholderText("you@example.test");
    expect(el.tagName).toBe("INPUT");
    expect(el.className).toContain("rounded-lg");
  });

  it("marks aria-invalid when invalid", () => {
    render(<Input invalid aria-label="budget" />);
    expect(screen.getByLabelText("budget")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});

describe("Textarea", () => {
  it("renders a textarea with a sensible min-height", () => {
    render(<Textarea name="kpi" />);
    const el = screen.getByRole("textbox");
    expect(el.tagName).toBe("TEXTAREA");
    expect(el.className).toContain("min-h-[84px]");
  });
});

describe("Label", () => {
  it("appends a cyan required star when required", () => {
    render(<Label required>Campaign name</Label>);
    const label = screen.getByText(/Campaign name/).closest("label")!;
    expect(label.textContent).toContain("*");
  });

  it("omits the required star by default", () => {
    render(<Label>Optional</Label>);
    expect(screen.getByText(/Optional/).textContent).not.toContain("*");
  });
});

describe("FieldError / FieldHint", () => {
  it("FieldError renders role=alert when children exist", () => {
    render(<FieldError>name is required</FieldError>);
    expect(screen.getByRole("alert")).toHaveTextContent("name is required");
  });

  it("FieldError returns null without children", () => {
    const { container } = render(<FieldError>{null}</FieldError>);
    expect(container.firstChild).toBeNull();
  });

  it("FieldHint renders the hint text", () => {
    render(<FieldHint>Use ISO 8601.</FieldHint>);
    expect(screen.getByText("Use ISO 8601.")).toBeInTheDocument();
  });

  it("FieldHint returns null without children", () => {
    const { container } = render(<FieldHint>{null}</FieldHint>);
    expect(container.firstChild).toBeNull();
  });
});
