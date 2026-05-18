/**
 * BL-031-F002 (D2) · productFilter auto-sync to selectedCampaign.productId.
 *
 * Symptom this fix targets: /zh/outreach + a campaign tied to "PUBG
 * Mobile" used to mount the composer with productFilter=null, so the
 * template list defaulted to "All products" and the marketer had to
 * manually pick PUBG Mobile from the dropdown to surface the 3 AI
 * email assets the campaign actually uses. Spec §D2 fix: useState
 * initialiser + useEffect sync, gated by a `userTouchedFilterRef` so
 * a deliberate "show me everything" reset isn't undone the moment a
 * sibling re-renders the composer.
 *
 * Hook-level coverage rather than full-component render: testing the
 * Combobox visually drags in `next/navigation`, `next-intl`, server
 * actions, and the KOL row table — none of which are part of the
 * state machine being verified. The exported `useProductFilter`
 * hook is the unit; TemplatePicker just wires it into the Combobox.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useProductFilter } from "../useProductFilter";

describe("useProductFilter — BL-031-F002 (D2)", () => {
  it("(1) mount initialises productFilter to selectedCampaign.productId", () => {
    const { result } = renderHook(({ pid }) => useProductFilter(pid), {
      initialProps: { pid: "prod-A" as string | null },
    });

    expect(result.current[0]).toBe("prod-A");
  });

  it("(2) switching selectedCampaignProductId via rerender auto-syncs the filter", () => {
    const { result, rerender } = renderHook(({ pid }) => useProductFilter(pid), {
      initialProps: { pid: "prod-A" as string | null },
    });
    expect(result.current[0]).toBe("prod-A");

    rerender({ pid: "prod-B" });
    expect(result.current[0]).toBe("prod-B");

    rerender({ pid: "prod-C" });
    expect(result.current[0]).toBe("prod-C");
  });

  it("(3) once the user manually changes the filter, subsequent campaign switches do not overwrite their choice", () => {
    const { result, rerender } = renderHook(({ pid }) => useProductFilter(pid), {
      initialProps: { pid: "prod-A" as string | null },
    });
    expect(result.current[0]).toBe("prod-A");

    // User picks a different product manually (e.g. "show me everything"
    // by selecting null, or a different product to compare cross-product
    // templates).
    act(() => result.current[1]("prod-X"));
    expect(result.current[0]).toBe("prod-X");

    // Switching campaign must NOT clobber the user's deliberate choice.
    rerender({ pid: "prod-B" });
    expect(result.current[0]).toBe("prod-X");

    // Even multiple campaign switches stay sticky.
    rerender({ pid: "prod-C" });
    expect(result.current[0]).toBe("prod-X");

    // Manual reset to null also counts as a touch — auto-sync must
    // not bring the campaign productId back.
    act(() => result.current[1](null));
    expect(result.current[0]).toBeNull();
    rerender({ pid: "prod-D" });
    expect(result.current[0]).toBeNull();
  });

  it("(4) selectedCampaignProductId=null fallback initialises filter to null without crashing", () => {
    const { result, rerender } = renderHook(({ pid }) => useProductFilter(pid), {
      initialProps: { pid: null as string | null },
    });
    expect(result.current[0]).toBeNull();

    // Edge case: campaign without a product → user picks one → switch
    // back to a campaign with productId. Both transitions stay safe.
    rerender({ pid: "prod-A" });
    expect(result.current[0]).toBe("prod-A");

    rerender({ pid: null });
    expect(result.current[0]).toBeNull();
  });
});
