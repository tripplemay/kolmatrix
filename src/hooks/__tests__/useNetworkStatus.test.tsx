/**
 * BL-052 F007 — useNetworkStatus hook.
 *
 * Drives the global online/offline events that the production banner
 * subscribes to. We seed `navigator.onLine` per test (jsdom provides
 * the property as writable) and dispatch the standard window events
 * to assert state transitions.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useNetworkStatus } from "../useNetworkStatus";

afterEach(() => {
  // Reset the navigator flag between cases so unrelated tests don't
  // leak an offline state into the next renderHook.
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  vi.useRealTimers();
});

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("useNetworkStatus", () => {
  it("seeds isOnline from navigator.onLine on mount and reports lastOfflineAt=null", () => {
    setOnLine(true);
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.lastOfflineAt).toBeNull();
  });

  it("flips to offline (and stamps lastOfflineAt) when the offline event fires", () => {
    setOnLine(true);
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.lastOfflineAt).toBeInstanceOf(Date);
  });

  it("flips back to online when the online event fires", () => {
    setOnLine(false);
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.isOnline).toBe(true);
    // lastOfflineAt is preserved so consumers can compute the offline
    // window. The banner's auto-dismiss runs off this signal.
    expect(result.current.lastOfflineAt).toBeInstanceOf(Date);
  });
});
