/**
 * BAux1-F004 · LoginForm unit suite
 *
 * Asserts the DOM contract of the cinematic login form:
 *   - heading + welcome copy render
 *   - both credential inputs carry the expected name/type/label
 *   - Google button is disabled + aria-disabled + Coming soon tooltip
 *   - typing fills both fields
 *   - "Request access" footer link points at /request-access
 *
 * Error-state rendering (invalid_credentials / missing_fields) is covered
 * by the E2E login flow (tests/e2e/login-cinematic.spec.ts) where a real
 * bad credential submission exercises the useActionState round-trip.
 * Unit-testing it would require mocking React's `useActionState`, which
 * is brittle across React minor versions.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/[locale]/login/actions", () => ({
  loginAction: vi.fn(async () => ({})),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href as string} {...rest}>
      {children}
    </a>
  ),
}));

import { renderIntl } from "../../../../tests/utils/render-intl";
import { LoginForm } from "../LoginForm";

describe("LoginForm", () => {
  it("renders email + password inputs with the expected copy", () => {
    renderIntl(<LoginForm />);
    expect(
      screen.getByRole("heading", { name: "Welcome back" })
    ).toBeInTheDocument();
    const email = screen.getByLabelText("Email address");
    const password = screen.getByLabelText("Password");
    expect(email).toHaveAttribute("name", "email");
    expect(email).toHaveAttribute("type", "email");
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("type", "password");
  });

  it("disables the Google button with aria-disabled + Coming soon tooltip", () => {
    renderIntl(<LoginForm />);
    const google = screen.getByRole("button", { name: /Continue with Google/i });
    expect(google).toBeDisabled();
    expect(google).toHaveAttribute("aria-disabled", "true");
    expect(google).toHaveAttribute("title", "Coming soon");
  });

  it("accepts text in both credential fields", async () => {
    const user = userEvent.setup();
    renderIntl(<LoginForm />);
    await user.type(screen.getByLabelText("Email address"), "sarah@studio.com");
    await user.type(screen.getByLabelText("Password"), "hunter2!");
    expect(screen.getByLabelText("Email address")).toHaveValue("sarah@studio.com");
    expect(screen.getByLabelText("Password")).toHaveValue("hunter2!");
  });

  it("renders the Request access footer link pointing at /request-access", () => {
    renderIntl(<LoginForm />);
    const link = screen.getByRole("link", { name: "Request access" });
    expect(link).toHaveAttribute("href", "/request-access");
  });

  it("exposes a Forgot password link (B5+ backend wires it up)", () => {
    renderIntl(<LoginForm />);
    expect(
      screen.getByRole("link", { name: /Forgot password/ })
    ).toBeInTheDocument();
  });

  it("exposes a Remember-device checkbox that is unchecked by default", () => {
    renderIntl(<LoginForm />);
    const remember = screen.getByLabelText(/Remember this device/i) as HTMLInputElement;
    expect(remember).toHaveAttribute("name", "rememberDevice");
    expect(remember).not.toBeChecked();
  });
});
