/**
 * BAux1-F004 · RequestAccessForm unit suite
 *
 * Asserts DOM-level contract:
 *   - all 8 fields render with their canonical name attributes
 *   - role dropdown exposes the 6 canonical enum values
 *   - campaignsPerQuarter dropdown exposes the 4 canonical enum values
 *   - ToS checkbox defaults unchecked and is named "tosAccepted"
 *   - sign-in anchor points at /{locale}/login
 *
 * Error-state + submit-flow (ok:true → router.push to /success) is covered
 * via tests/e2e/request-access.spec.ts — unit suite avoids mocking
 * useActionState to stay resilient across React minor versions.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const testRefs = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: testRefs.pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href as string} {...rest}>
      {children}
    </a>
  ),
}));

// Flat mock — we must NOT use `vi.importActual` here. The real module is
// marked `"use server"` and imports `@/lib/db` (which throws at module
// init when DATABASE_URL is unset — true for the unit vitest run) plus
// `@/lib/email/access-request` (which imports `resend`). Loading it just
// to spread `{...actual}` crashes the whole suite. The component only
// consumes `submitAccessRequest` at runtime and `SubmitAccessRequestState`
// as a type (types aren't present at runtime), so a flat fn mock is
// sufficient.
vi.mock("@/app/[locale]/request-access/actions", () => ({
  submitAccessRequest: vi.fn(async () => ({ ok: true })),
}));

import { renderIntl } from "../../../../tests/utils/render-intl";
import { RequestAccessForm } from "../RequestAccessForm";

describe("RequestAccessForm", () => {
  it("renders all 8 form fields via their name attributes", () => {
    renderIntl(<RequestAccessForm locale="en" />);
    const form = screen
      .getByRole("button", { name: /Submit request/i })
      .closest("form");
    expect(form).not.toBeNull();
    const names = [
      "firstName",
      "lastName",
      "email",
      "company",
      "role",
      "campaignsPerQuarter",
      "games",
      "tosAccepted",
    ];
    for (const n of names) {
      expect(form!.querySelector(`[name="${n}"]`)).not.toBeNull();
    }
  });

  it("offers the 6 canonical role options", () => {
    renderIntl(<RequestAccessForm locale="en" />);
    const select = screen.getByRole("combobox", { name: /Role/i }) as HTMLSelectElement;
    const values = Array.from(select.options)
      .map((o) => o.value)
      .filter(Boolean);
    expect(values).toEqual([
      "marketing-manager",
      "influencer-relations",
      "growth-lead",
      "founder",
      "agency-pm",
      "other",
    ]);
  });

  it("offers the 4 canonical campaignsPerQuarter options", () => {
    renderIntl(<RequestAccessForm locale="en" />);
    const select = screen.getByRole("combobox", {
      name: /Campaigns/i,
    }) as HTMLSelectElement;
    const values = Array.from(select.options)
      .map((o) => o.value)
      .filter(Boolean);
    expect(values).toEqual(["0-5", "6-20", "21-50", "50+"]);
  });

  it("marks ToS checkbox present and unchecked by default", () => {
    renderIntl(<RequestAccessForm locale="en" />);
    const tos = screen.getByRole("checkbox") as HTMLInputElement;
    expect(tos).not.toBeChecked();
    expect(tos).toHaveAttribute("name", "tosAccepted");
  });

  it("points the Sign in link at /{locale}/login", () => {
    renderIntl(<RequestAccessForm locale="zh" />);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/zh/login");
  });
});
