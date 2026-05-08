/**
 * BL-052 F007 — NetworkStatusBanner integration with useNetworkStatus.
 *
 * Drives the full hook + component path (not the hook in isolation):
 *   1. online start → banner not in DOM
 *   2. offline event → banner appears, role=status, data-state=offline
 *   3. online event → banner switches to "back-online" state, then
 *      auto-dismisses after the 2s timer.
 */
import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NetworkStatusBanner } from "../NetworkStatusBanner";

const messages = {
  common: {
    network: {
      offline: "You are offline. Reconnecting...",
      backOnline: "Back online",
    },
  },
};

function withIntl(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setOnLine(true);
});

afterEach(() => {
  vi.useRealTimers();
  setOnLine(true);
});

describe("NetworkStatusBanner", () => {
  // BL-055 F001 — mount-flag guards the very first render so a hydrate
  // race where navigator.onLine briefly returns false can't paint the
  // offline banner before the network stack stabilizes. SSR-equivalent
  // first paint must be empty regardless of navigator state.
  it("renders nothing on the first render (mounted=false), even when navigator reports offline", () => {
    setOnLine(false);
    const html = renderToString(withIntl(<NetworkStatusBanner />));
    expect(html).toBe("");
  });

  it("renders nothing when the page starts online and no offline event has fired", () => {
    render(withIntl(<NetworkStatusBanner />));
    expect(screen.queryByTestId("network-status-banner")).not.toBeInTheDocument();
  });

  it("appears in offline state after the offline event", () => {
    render(withIntl(<NetworkStatusBanner />));
    // Flush the mount-flag setTimeout(_, 0) so the banner exits its
    // pre-mount null-render state before we drive the offline path.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });
    const banner = screen.getByTestId("network-status-banner");
    expect(banner).toHaveAttribute("data-state", "offline");
    expect(banner).toHaveTextContent("You are offline. Reconnecting...");
  });

  it("switches to back-online toast after online event, then auto-dismisses", () => {
    render(withIntl(<NetworkStatusBanner />));

    act(() => {
      vi.advanceTimersByTime(0);
    });
    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("network-status-banner")).toHaveAttribute(
      "data-state",
      "offline"
    );

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });
    // The show is dispatched via setTimeout(_, 0) so eslint
    // react-hooks/set-state-in-effect stays satisfied — flush that
    // microtask-shaped tick before reading the DOM.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const restored = screen.getByTestId("network-status-banner");
    expect(restored).toHaveAttribute("data-state", "back-online");
    expect(restored).toHaveTextContent("Back online");

    // Advance past the 2s auto-dismiss window — banner unmounts.
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.queryByTestId("network-status-banner")).not.toBeInTheDocument();
  });
});
