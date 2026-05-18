/**
 * BL-069-F003 · BriefPageClient integration tests.
 *
 * Mounts BriefPageClient (which composes BriefAiInputBar + CampaignForm
 * via forwardRef) and exercises the 5 acceptance points from spec §F003:
 *
 *   1. mount 空表单 — initial render, empty form, no toast.
 *   2. Generate 成功 → 字段自动填 — parsed fields auto-fill empty inputs.
 *   3. Generate unparsable → 表单不变 + toast — form state preserved,
 *      unparsable toast renders.
 *   4. Generate cap 满 → toast + 表单不变 — cap toast renders, form
 *      preserved.
 *   5. 已填字段不被 LLM 覆盖 + diff hint 显 — user-filled value stays;
 *      AI suggestion surfaces as a diff hint instead.
 *
 * parseBriefAction is mocked at the module boundary so the test runs
 * without auth, DB, or aigcgateway.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

const parseBriefMock = vi.fn();
const createCampaignFromBriefMock = vi.fn();
vi.mock("../brief-actions", () => ({
  parseBriefAction: (...args: unknown[]) => parseBriefMock(...args),
  createCampaignFromBriefAction: (...args: unknown[]) =>
    createCampaignFromBriefMock(...args),
}));

const { BriefPageClient } = await import("../BriefPageClient");

const PRODUCTS = [
  { id: "cprod1111111111111111", name: "Genshin Impact", category: "mobile-game" },
  { id: "cprod2222222222222222", name: "Clash Royale", category: "mobile-game" },
];

const AI_LABELS = {
  inputPlaceholder: "Describe your brief…",
  generateButton: "Generate",
  loading: "Parsing…",
  feedbackPrefix: "AI:",
  unparsableToast: "Could not parse the brief. Try including market, budget, or audience.",
  malformedToast: "AI response was malformed.",
  productCrossTenantToast: "AI suggested a product not in your library.",
  capExhaustedToast: "Daily AI quota reached.",
  networkError: "Network error.",
};

const FORM_LABELS = {
  name: "Campaign name",
  nameHint: "Short label",
  product: "Product",
  productSelectorLabel: "Product",
  manageProductsLink: "Manage products",
  noProducts: "No products",
  budgetAmount: "Budget",
  budgetCurrency: "Currency",
  budgetHint: "Optional",
  startDate: "Start date",
  endDate: "End date",
  markets: "Markets",
  targetAudience: "Target audience",
  targetAudienceHint: "Free text",
  categories: "Categories",
  categoriesHint: "Comma-separated",
  submit: "Create Campaign",
  submitting: "Creating…",
  aiDiffHintPrefix: "AI suggests:",
};

const MARKET_LABELS = {
  global: "Global",
  us: "US",
  eu: "EU",
  jp: "Japan",
  kr: "Korea",
  sea: "Southeast Asia",
  cn: "China",
  latam: "LATAM",
};

const SUBMIT_ERROR_LABELS = {
  unauthorized: "Please sign in again.",
  validationFailed: "Pick a product first.",
  productNotFound: "Product not found.",
  internalError: "Could not create campaign.",
};

function renderClient() {
  return render(
    <BriefPageClient
      locale="en"
      products={PRODUCTS}
      aiLabels={AI_LABELS}
      formLabels={FORM_LABELS}
      marketLabels={MARKET_LABELS}
      submitErrorLabels={SUBMIT_ERROR_LABELS}
    />,
  );
}

async function submitBrief(text: string) {
  fireEvent.change(screen.getByTestId("brief-ai-input"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByTestId("brief-ai-generate"));
}

beforeEach(() => {
  parseBriefMock.mockReset();
  createCampaignFromBriefMock.mockReset();
  pushMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BL-069-F003 BriefPageClient", () => {
  it("1. mount empty form — no toast, all inputs empty", () => {
    renderClient();
    expect(screen.getByTestId("brief-ai-input-bar")).toBeInTheDocument();
    expect(screen.getByTestId("brief-campaign-form")).toBeInTheDocument();
    // No toast rendered initially.
    expect(screen.queryByTestId("brief-ai-toast-success")).toBeNull();
    expect(screen.queryByTestId("brief-ai-toast-unparsable")).toBeNull();
    expect(screen.queryByTestId("brief-ai-toast-cap")).toBeNull();
    // Empty fields.
    expect(
      (screen.getByTestId("brief-name-input") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByTestId("brief-budget-amount") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByTestId("brief-target-audience") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("2. Generate success → empty fields auto-filled from parsed payload", async () => {
    parseBriefMock.mockResolvedValue({
      ok: true,
      data: {
        parsed: {
          productId: "cprod1111111111111111",
          markets: ["SEA", "JP"],
          budget: { amount: 10000, currency: "USD" },
          targetAudience: "SEA mobile gamers 18-25",
          categories: ["mobile-game", "rpg"],
          startDate: "2026-04-01",
          endDate: "2026-06-30",
        },
        feedback: "Parsed: SEA market, $10K USD, mobile-game",
        unparsable: false,
        capExhausted: false,
      },
    });
    renderClient();
    await submitBrief("Q2 推 Genshin Impact 给东南亚游戏受众");

    await waitFor(() => {
      expect(parseBriefMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      const productSelect = screen.getByTestId(
        "brief-product-select",
      ) as HTMLSelectElement;
      expect(productSelect.value).toBe("cprod1111111111111111");
    });
    expect(
      (screen.getByTestId("brief-budget-amount") as HTMLInputElement).value,
    ).toBe("10000");
    expect(
      (screen.getByTestId("brief-target-audience") as HTMLTextAreaElement)
        .value,
    ).toBe("SEA mobile gamers 18-25");
    expect(
      (screen.getByTestId("brief-start-date") as HTMLInputElement).value,
    ).toBe("2026-04-01");
    expect(
      (screen.getByTestId("brief-end-date") as HTMLInputElement).value,
    ).toBe("2026-06-30");
    // SEA + JP markets checked.
    expect(
      (screen.getByTestId("brief-market-sea") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByTestId("brief-market-jp") as HTMLInputElement).checked,
    ).toBe(true);
    // Success toast visible.
    expect(screen.getByTestId("brief-ai-toast-success")).toHaveTextContent(
      "Parsed: SEA market",
    );
  });

  it("3. Generate unparsable → toast + form state unchanged", async () => {
    parseBriefMock.mockResolvedValue({
      ok: true,
      data: {
        parsed: null,
        feedback: "Could not parse — please be more specific about market/budget.",
        unparsable: true,
        capExhausted: false,
        errorKind: "unparsable",
      },
    });
    renderClient();
    await submitBrief("hello");
    await waitFor(() => {
      expect(screen.getByTestId("brief-ai-toast-unparsable")).toBeInTheDocument();
    });
    // Form fields remain empty.
    expect(
      (screen.getByTestId("brief-budget-amount") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByTestId("brief-target-audience") as HTMLTextAreaElement)
        .value,
    ).toBe("");
    expect(
      (screen.getByTestId("brief-market-sea") as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("4. Generate cap exhausted → cap toast + form unchanged", async () => {
    parseBriefMock.mockResolvedValue({
      ok: true,
      data: {
        parsed: null,
        feedback: "",
        unparsable: false,
        capExhausted: true,
      },
    });
    renderClient();
    await submitBrief("Q2 推产品");
    await waitFor(() => {
      expect(screen.getByTestId("brief-ai-toast-cap")).toBeInTheDocument();
    });
    expect(
      (screen.getByTestId("brief-budget-amount") as HTMLInputElement).value,
    ).toBe("");
  });

  it("5. user-filled field stays + AI suggestion surfaces as diff hint (§5 不变量 #6)", async () => {
    renderClient();
    // User fills budget manually.
    fireEvent.change(screen.getByTestId("brief-budget-amount"), {
      target: { value: "5000" },
    });
    expect(
      (screen.getByTestId("brief-budget-amount") as HTMLInputElement).value,
    ).toBe("5000");

    // AI parses + suggests a DIFFERENT budget.
    parseBriefMock.mockResolvedValue({
      ok: true,
      data: {
        parsed: {
          productId: "cprod2222222222222222",
          markets: ["US"],
          budget: { amount: 10000, currency: "USD" },
          targetAudience: "New target description",
          categories: ["mobile-game"],
          startDate: "2026-07-01",
          endDate: "2026-09-30",
        },
        feedback: "parsed",
        unparsable: false,
        capExhausted: false,
      },
    });
    await submitBrief("Push Clash Royale to US, $10K");

    await waitFor(() => {
      expect(parseBriefMock).toHaveBeenCalled();
    });
    // Budget value PRESERVED at user's 5000 (not overwritten).
    await waitFor(() => {
      expect(
        (screen.getByTestId("brief-budget-amount") as HTMLInputElement).value,
      ).toBe("5000");
    });
    // Diff hint visible for budget field showing AI's suggestion.
    expect(
      screen.getByTestId("brief-ai-hint-budgetAmount"),
    ).toHaveTextContent("10000");
    // Empty fields DID get filled.
    expect(
      (screen.getByTestId("brief-target-audience") as HTMLTextAreaElement)
        .value,
    ).toBe("New target description");
  });

  it("6. parseBrief throws → network toast + form preserved", async () => {
    parseBriefMock.mockRejectedValue(new Error("net fail"));
    renderClient();
    await submitBrief("Q2 brief");
    await waitFor(() => {
      expect(screen.getByTestId("brief-ai-toast-network")).toBeInTheDocument();
    });
  });

  it("7. errorKind=product_cross_tenant → distinct toast (not plain unparsable)", async () => {
    parseBriefMock.mockResolvedValue({
      ok: true,
      data: {
        parsed: null,
        feedback: "",
        unparsable: true,
        capExhausted: false,
        errorKind: "product_cross_tenant",
      },
    });
    renderClient();
    await submitBrief("Push Mystery Product");
    await waitFor(() => {
      expect(
        screen.getByTestId("brief-ai-toast-product-cross-tenant"),
      ).toBeInTheDocument();
    });
    // Plain unparsable toast must NOT also render.
    expect(screen.queryByTestId("brief-ai-toast-unparsable")).toBeNull();
  });

  it("8. submit success → createCampaignFromBriefAction called + router.push to /match (F005)", async () => {
    createCampaignFromBriefMock.mockResolvedValue({
      ok: true,
      campaignId: "newcamp-aaaa-bbbb-cccc-ddddeeeeffff",
    });
    renderClient();
    // Pick a product so client-side guard passes.
    fireEvent.change(screen.getByTestId("brief-product-select"), {
      target: { value: PRODUCTS[0].id },
    });
    // Fire the submit button (form onSubmit).
    fireEvent.click(screen.getByTestId("brief-submit"));
    await waitFor(() => {
      expect(createCampaignFromBriefMock).toHaveBeenCalledTimes(1);
    });
    // router.push to /en/match?campaignId=... was invoked.
    expect(pushMock).toHaveBeenCalledWith(
      "/en/match?campaignId=newcamp-aaaa-bbbb-cccc-ddddeeeeffff",
    );
    // No submit-error banner rendered.
    expect(screen.queryByTestId("brief-submit-error")).toBeNull();
  });

  it("9. submit fail (product_not_found) → error banner + no router.push (F005)", async () => {
    createCampaignFromBriefMock.mockResolvedValue({
      ok: false,
      error: "product_not_found",
    });
    renderClient();
    fireEvent.change(screen.getByTestId("brief-product-select"), {
      target: { value: PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByTestId("brief-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("brief-submit-error")).toHaveTextContent(
        "Product not found.",
      );
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("10. submit without product → inline validation error, no action call (F005)", async () => {
    renderClient();
    // No product picked. Submit triggers client-side guard.
    fireEvent.click(screen.getByTestId("brief-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("brief-submit-error")).toHaveTextContent(
        "Pick a product first.",
      );
    });
    expect(createCampaignFromBriefMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
