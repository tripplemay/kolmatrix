/**
 * BL-105-F001 · CampaignEditForm — field render + submit wiring.
 *
 * Verifies the form renders the action's exact field set with current
 * values, submits a FormData to updateCampaignFieldsAction, and surfaces
 * the saved / error states. The action is mocked at the module boundary.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateCampaignFieldsActionMock = vi.fn();
vi.mock("../../actions", () => ({
  updateCampaignFieldsAction: (...args: unknown[]) =>
    updateCampaignFieldsActionMock(...args),
}));

import { CampaignEditForm } from "../CampaignEditForm";

const labels = {
  fields: {
    name: "Campaign name",
    budgetAmount: "Budget",
    startDate: "Start",
    endDate: "End",
    game: "Game",
  },
  save: "Save changes",
  saving: "Saving…",
  saved: "Changes saved.",
  errors: {
    validation_failed: "Please check the fields.",
    generic: "Something went wrong.",
  },
};

const campaign = {
  id: "33333333-4444-5555-6666-777777777777",
  name: "Summer Push",
  budgetAmount: 10000,
  startDate: "2026-06-01T00:00:00.000Z",
  endDate: "2026-06-30T00:00:00.000Z",
  game: "Clash Royale",
};

function renderForm() {
  return render(<CampaignEditForm campaign={campaign} labels={labels} />);
}

beforeEach(() => {
  updateCampaignFieldsActionMock.mockReset().mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CampaignEditForm", () => {
  it("renders the action's field set with current values + hidden campaignId", () => {
    const { container } = renderForm();
    expect(screen.getByTestId("campaign-edit-name")).toHaveValue("Summer Push");
    expect(screen.getByTestId("campaign-edit-budget")).toHaveValue("10000");
    expect(screen.getByTestId("campaign-edit-start-date")).toHaveValue("2026-06-01");
    expect(screen.getByTestId("campaign-edit-end-date")).toHaveValue("2026-06-30");
    expect(screen.getByTestId("campaign-edit-game")).toHaveValue("Clash Royale");
    const hidden = container.querySelector('input[name="campaignId"]');
    expect(hidden).toHaveValue(campaign.id);
  });

  it("submits a FormData carrying campaignId + edited name to the action", async () => {
    const user = userEvent.setup();
    renderForm();

    const name = screen.getByTestId("campaign-edit-name");
    await user.clear(name);
    await user.type(name, "Autumn Push");
    await user.click(screen.getByTestId("campaign-edit-save"));

    await waitFor(() => expect(updateCampaignFieldsActionMock).toHaveBeenCalledTimes(1));
    const formData = updateCampaignFieldsActionMock.mock.calls[0]![1] as FormData;
    expect(formData.get("campaignId")).toBe(campaign.id);
    expect(formData.get("name")).toBe("Autumn Push");
  });

  it("shows the saved banner after a successful save", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId("campaign-edit-save"));
    expect(await screen.findByTestId("campaign-edit-saved")).toHaveTextContent("Changes saved.");
  });

  it("maps the action error code to a localized message", async () => {
    updateCampaignFieldsActionMock.mockResolvedValueOnce({
      ok: false,
      error: "validation_failed",
    });
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId("campaign-edit-save"));
    expect(await screen.findByTestId("campaign-edit-error")).toHaveTextContent(
      "Please check the fields.",
    );
  });
});
