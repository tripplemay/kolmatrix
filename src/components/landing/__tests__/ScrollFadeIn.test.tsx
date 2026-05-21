import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScrollFadeIn } from "../ScrollFadeIn";

describe("ScrollFadeIn", () => {
  let originalIO: typeof IntersectionObserver;
  let observeCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    originalIO = window.IntersectionObserver;
    // Mock IO so we control when the in-view callback fires.
    // Must be a real constructor (class) — `new vi.fn(arrow)` is not a
    // constructor in newer Vitest / V8 versions.
    class MockIO {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      root = null;
      rootMargin = "";
      thresholds: number[] = [];
      takeRecords = vi.fn(() => []);
      constructor(cb: IntersectionObserverCallback) {
        observeCallback = cb;
      }
    }
    window.IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalIO;
    observeCallback = null;
  });

  it("renders children with initial out-of-view state", () => {
    render(
      <ScrollFadeIn>
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = screen.getByTestId("scroll-fade-in");
    expect(wrapper.getAttribute("data-state")).toBe("hidden");
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("transitions to in-view state when IntersectionObserver callback fires", () => {
    render(
      <ScrollFadeIn>
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = screen.getByTestId("scroll-fade-in");

    // Simulate IO firing with isIntersecting=true. Wrap in act() because
    // the callback triggers a React state update outside the React lifecycle.
    act(() => {
      observeCallback!(
        [
          {
            isIntersecting: true,
            target: wrapper,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRatio: 0.5,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: Date.now(),
          },
        ],
        {} as IntersectionObserver
      );
    });

    expect(wrapper.getAttribute("data-state")).toBe("visible");
  });

  it("respects optional delay attribute", () => {
    render(
      <ScrollFadeIn delayMs={200}>
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = screen.getByTestId("scroll-fade-in");
    expect(wrapper.style.transitionDelay).toBe("200ms");
  });
});
