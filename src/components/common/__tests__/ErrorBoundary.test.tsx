/**
 * BIx-mvp-polish-pass F003 — ErrorBoundary contract test.
 *
 * Verifies the friendly fallback renders and that the retry CTA
 * invokes the `reset` callback Next passes through.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "../ErrorBoundary";

const messages = {
  common: {
    error: {
      title: "Something went wrong",
      body: "We hit an unexpected error.",
      retry: "Try again",
      backHome: "Back to dashboard",
    },
  },
};

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("ErrorBoundary", () => {
  it("renders the friendly title + body + both CTAs", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    renderWithIntl(<ErrorBoundary error={error} reset={reset} scope="dashboard" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/unexpected error/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to dashboard/i })).toBeInTheDocument();
  });

  it("surfaces the digest as `ref · <hash>`", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "trc_xyz" });
    renderWithIntl(<ErrorBoundary error={error} reset={reset} scope="campaigns" />);
    expect(screen.getByText(/ref · trc_xyz/)).toBeInTheDocument();
  });

  it("does not render the digest line when no digest is present", () => {
    const reset = vi.fn();
    const error = new Error("dev-mode boom") as Error & { digest?: string };
    renderWithIntl(<ErrorBoundary error={error} reset={reset} />);
    expect(screen.queryByText(/^ref · /)).toBeNull();
  });

  it("calls reset() when the Try-again button is clicked", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "x" });
    renderWithIntl(<ErrorBoundary error={error} reset={reset} scope="discovery" />);
    await user.click(screen.getByRole("button", { name: /Try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders data-scope attribute for ops correlation", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "x" });
    renderWithIntl(<ErrorBoundary error={error} reset={reset} scope="outreach" />);
    const root = screen.getByTestId("route-error-boundary");
    expect(root).toHaveAttribute("data-scope", "outreach");
  });
});
