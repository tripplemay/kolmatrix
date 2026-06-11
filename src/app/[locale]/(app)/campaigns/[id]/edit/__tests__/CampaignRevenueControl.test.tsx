/**
 * BL-105-F002 · CampaignRevenueControl — record + locked state.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordRevenueActionMock = vi.fn();
vi.mock("../../actions", () => ({
  recordRevenueAction: (...args: unknown[]) => recordRevenueActionMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { CampaignRevenueControl } from "../CampaignRevenueControl";

const labels = {
  label: "Recorded revenue (USD)",
  hint: "Leave blank to clear.",
  lockedHint: "Reactivate the campaign to edit revenue.",
  save: "Record revenue",
  saving: "Saving…",
  saved: "Revenue recorded.",
  errors: { revenueInvalid: "Bad amount.", forbidden_when_completed: "Locked.", generic: "Oops." },
};

const CAMPAIGN = "33333333-4444-5555-6666-777777777777";

beforeEach(() => {
  recordRevenueActionMock.mockReset().mockResolvedValue({ ok: true });
  refreshMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe("CampaignRevenueControl", () => {
  it("submits the revenue amount and refreshes on success", async () => {
    const user = userEvent.setup();
    render(
      <CampaignRevenueControl
        campaignId={CAMPAIGN}
        currentRevenue={500}
        locked={false}
        labels={labels}
      />,
    );
    const input = screen.getByTestId("campaign-revenue-input");
    expect(input).toHaveValue("500");
    await user.clear(input);
    await user.type(input, "1250.50");
    await user.click(screen.getByTestId("campaign-revenue-save"));

    await waitFor(() => expect(recordRevenueActionMock).toHaveBeenCalledTimes(1));
    const fd = recordRevenueActionMock.mock.calls[0]![1] as FormData;
    expect(fd.get("campaignId")).toBe(CAMPAIGN);
    expect(fd.get("revenue")).toBe("1250.50");
    expect(await screen.findByTestId("campaign-revenue-saved")).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("locks the editor + shows the reactivate hint when completed", () => {
    render(
      <CampaignRevenueControl
        campaignId={CAMPAIGN}
        currentRevenue={null}
        locked
        labels={labels}
      />,
    );
    expect(screen.getByTestId("campaign-revenue-input")).toBeDisabled();
    expect(screen.getByTestId("campaign-revenue-save")).toBeDisabled();
    expect(screen.getByTestId("campaign-revenue-hint")).toHaveTextContent(
      "Reactivate the campaign to edit revenue.",
    );
  });

  it("maps the action error code", async () => {
    recordRevenueActionMock.mockResolvedValueOnce({ ok: false, error: "revenueInvalid" });
    const user = userEvent.setup();
    render(
      <CampaignRevenueControl
        campaignId={CAMPAIGN}
        currentRevenue={null}
        locked={false}
        labels={labels}
      />,
    );
    await user.click(screen.getByTestId("campaign-revenue-save"));
    expect(await screen.findByTestId("campaign-revenue-error")).toHaveTextContent("Bad amount.");
  });
});
