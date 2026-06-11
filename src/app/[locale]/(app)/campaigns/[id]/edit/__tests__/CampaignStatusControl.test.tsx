/**
 * BL-105-F002 · CampaignStatusControl — transition wiring.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transitionStatusActionMock = vi.fn();
vi.mock("../../actions", () => ({
  transitionStatusAction: (...args: unknown[]) => transitionStatusActionMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { CampaignStatusControl } from "../CampaignStatusControl";

const labels = {
  label: "Status",
  current: "Current",
  moveToTemplate: "Move to {status}",
  applying: "Updating…",
  updated: "Status updated.",
  noTransitions: "No status change available from here.",
  statusNames: { draft: "Draft", active: "Active", completed: "Completed" },
  errors: { invalid_transition: "Not allowed.", generic: "Oops." },
};

const CAMPAIGN = "33333333-4444-5555-6666-777777777777";

beforeEach(() => {
  transitionStatusActionMock.mockReset().mockResolvedValue({ ok: true });
  refreshMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe("CampaignStatusControl", () => {
  it("renders a transition button per allowed next state", () => {
    render(
      <CampaignStatusControl
        campaignId={CAMPAIGN}
        current="draft"
        allowedNext={["active"]}
        labels={labels}
      />,
    );
    expect(screen.getByTestId("campaign-status-current")).toHaveTextContent("Current: Draft");
    expect(screen.getByTestId("campaign-status-to-active")).toHaveTextContent("Move to Active");
  });

  it("submits campaignId + next and refreshes on success", async () => {
    const user = userEvent.setup();
    render(
      <CampaignStatusControl
        campaignId={CAMPAIGN}
        current="active"
        allowedNext={["completed"]}
        labels={labels}
      />,
    );
    await user.click(screen.getByTestId("campaign-status-to-completed"));

    await waitFor(() => expect(transitionStatusActionMock).toHaveBeenCalledTimes(1));
    const fd = transitionStatusActionMock.mock.calls[0]![1] as FormData;
    expect(fd.get("campaignId")).toBe(CAMPAIGN);
    expect(fd.get("next")).toBe("completed");
    expect(await screen.findByTestId("campaign-status-updated")).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows the no-transitions hint when there are none", () => {
    render(
      <CampaignStatusControl
        campaignId={CAMPAIGN}
        current="completed"
        allowedNext={[]}
        labels={{ ...labels }}
      />,
    );
    expect(screen.getByTestId("campaign-status-none")).toHaveTextContent(
      "No status change available from here.",
    );
  });

  it("surfaces the action error code", async () => {
    transitionStatusActionMock.mockResolvedValueOnce({ ok: false, error: "invalid_transition" });
    const user = userEvent.setup();
    render(
      <CampaignStatusControl
        campaignId={CAMPAIGN}
        current="draft"
        allowedNext={["active"]}
        labels={labels}
      />,
    );
    await user.click(screen.getByTestId("campaign-status-to-active"));
    expect(await screen.findByTestId("campaign-status-error")).toHaveTextContent("Not allowed.");
  });
});
