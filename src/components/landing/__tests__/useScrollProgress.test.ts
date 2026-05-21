import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef } from "react";
import { useScrollProgress } from "../useScrollProgress";

// Mock scroll-triggered geometry: jsdom's getBoundingClientRect returns
// zeroes, so we patch it for each test.
function mockRect(top: number, height: number) {
  return {
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("useScrollProgress", () => {
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerHeight", {
      value: originalInnerHeight,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it("returns 0 when element is below viewport", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      // Simulate a mounted element below viewport
      const el = document.createElement("div");
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue(mockRect(900, 400));
      (ref as { current: HTMLElement | null }).current = el;
      return useScrollProgress(ref);
    });

    // Initial paint runs handler() once. Below viewport → top > startOffset
    // (which defaults to innerHeight=800) → progress clamps to 0.
    expect(result.current).toBe(0);
  });

  it("returns ~1 when element is fully above viewport", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      const el = document.createElement("div");
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue(mockRect(-500, 400));
      (ref as { current: HTMLElement | null }).current = el;
      return useScrollProgress(ref);
    });

    expect(result.current).toBe(1);
  });

  it("returns ~0.5 when element top is halfway through the viewport", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      const el = document.createElement("div");
      // innerHeight=800, height=400, default start=800, default end=-400
      // total span = 1200. At top=200, current=800-200=600. progress=600/1200=0.5
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue(mockRect(200, 400));
      (ref as { current: HTMLElement | null }).current = el;
      return useScrollProgress(ref);
    });

    expect(result.current).toBeCloseTo(0.5, 1);
  });

  it("re-computes progress on scroll event", () => {
    const el = document.createElement("div");
    const getRect = vi.spyOn(el, "getBoundingClientRect").mockReturnValue(mockRect(900, 400));

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      (ref as { current: HTMLElement | null }).current = el;
      return useScrollProgress(ref);
    });

    expect(result.current).toBe(0);

    // Simulate scroll moving element up into viewport
    getRect.mockReturnValue(mockRect(200, 400));
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current).toBeCloseTo(0.5, 1);
  });
});
