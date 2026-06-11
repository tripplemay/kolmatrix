/**
 * BL-105-F003 · AcceptedKolRow inline ops (canEdit-gated).
 *
 * Verifies the restored inline surfaces call the right orphan actions,
 * the optimistic status change rolls back on failure, and that a
 * non-editor (canEdit=false) keeps the BL-066-F006 read-only row.
 * Actions + router are mocked at the module boundary.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateKolContactStatusActionMock = vi.fn();
const updateKolFeeActionMock = vi.fn();
const removeKolActionMock = vi.fn();
vi.mock("../actions", () => ({
  updateKolContactStatusAction: (...a: unknown[]) => updateKolContactStatusActionMock(...a),
  updateKolFeeAction: (...a: unknown[]) => updateKolFeeActionMock(...a),
  removeKolAction: (...a: unknown[]) => removeKolActionMock(...a),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href as string} {...rest}>
      {children}
    </a>
  ),
}));

import { AcceptedKolRow } from "../AcceptedKolRow";

const CAMPAIGN = "33333333-4444-5555-6666-777777777777";
const KOL = "kkkkkkkk-1111-1111-1111-111111111111";

const statusLabels = {
  pending: "Pending",
  contacted: "Contacted",
  quoted: "Quoted",
  signed: "Signed",
  delivered: "Delivered",
  paid: "Paid",
};
const editLabels = {
  statusAria: "Change contact status",
  feeEdit: "Edit fee",
  feeSave: "Save",
  feeCancel: "Cancel",
  feeAria: "Fee in USD",
  remove: "Remove from campaign",
  removeConfirm: "Remove?",
  removeYes: "Remove",
  removeNo: "Cancel",
  errors: {
    feeInvalid: "Enter a valid fee.",
    invalid_fee: "Enter a valid fee.",
    invalid_status: "Invalid status.",
    link_not_found: "This KOL is no longer in the campaign.",
    unauthorized: "No permission.",
    generic: "Something went wrong.",
  },
};
const row = {
  kolCampaignId: "kc-1",
  kolId: KOL,
  displayName: "Jane Creator",
  handle: "jane",
  platform: "youtube",
  avatarUrl: null,
  followerCount: 12000,
  hasEmail: true,
  contactStatus: "pending",
  kolFee: 100,
  addedAt: "2026-06-01T00:00:00.000Z",
  source: "ai_smart_match",
  suggestionStatus: "accepted" as string | null,
};

function renderRow(canEdit: boolean) {
  return render(
    <table>
      <tbody>
        <AcceptedKolRow
          locale="en"
          campaignId={CAMPAIGN}
          row={row}
          statusLabels={statusLabels}
          sourceChipLabels={{ ai: "AI", csv: "CSV", legacy: "Legacy" }}
          viewProfileLabel="View profile"
          feeUnsetLabel="—"
          canEdit={canEdit}
          editLabels={editLabels}
        />
      </tbody>
    </table>,
  );
}

beforeEach(() => {
  updateKolContactStatusActionMock.mockReset().mockResolvedValue({ ok: true });
  updateKolFeeActionMock.mockReset().mockResolvedValue({ ok: true });
  removeKolActionMock.mockReset().mockResolvedValue({ ok: true });
  refreshMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe("AcceptedKolRow — read-only (canEdit=false)", () => {
  it("renders status + fee as text with no edit surfaces", () => {
    renderRow(false);
    expect(screen.getByTestId("accepted-kol-status")).toHaveTextContent("Pending");
    expect(screen.getByTestId("accepted-kol-fee")).toHaveTextContent("100.00");
    expect(screen.queryByTestId("accepted-kol-status-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("accepted-kol-remove")).not.toBeInTheDocument();
    expect(screen.getByTestId("accepted-kol-view-profile")).toBeInTheDocument();
  });
});

describe("AcceptedKolRow — inline ops (canEdit=true)", () => {
  it("changes contact status via the action + refreshes", async () => {
    const user = userEvent.setup();
    renderRow(true);
    await user.selectOptions(screen.getByTestId("accepted-kol-status-select"), "contacted");

    await waitFor(() => expect(updateKolContactStatusActionMock).toHaveBeenCalledTimes(1));
    const fd = updateKolContactStatusActionMock.mock.calls[0]![1] as FormData;
    expect(fd.get("campaignId")).toBe(CAMPAIGN);
    expect(fd.get("kolId")).toBe(KOL);
    expect(fd.get("contactStatus")).toBe("contacted");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("rolls the optimistic status back when the action fails", async () => {
    updateKolContactStatusActionMock.mockResolvedValueOnce({ ok: false, error: "invalid_status" });
    const user = userEvent.setup();
    renderRow(true);
    const select = screen.getByTestId("accepted-kol-status-select") as HTMLSelectElement;
    await user.selectOptions(select, "contacted");

    expect(await screen.findByTestId("accepted-kol-error")).toHaveTextContent("Invalid status.");
    await waitFor(() => expect(select.value).toBe("pending")); // rolled back
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("saves an edited fee via the action", async () => {
    const user = userEvent.setup();
    renderRow(true);
    await user.click(screen.getByTestId("accepted-kol-fee-edit"));
    const input = screen.getByTestId("accepted-kol-fee-input");
    await user.clear(input);
    await user.type(input, "250.50");
    await user.click(screen.getByTestId("accepted-kol-fee-save"));

    await waitFor(() => expect(updateKolFeeActionMock).toHaveBeenCalledTimes(1));
    const fd = updateKolFeeActionMock.mock.calls[0]![1] as FormData;
    expect(fd.get("kolFee")).toBe("250.50");
  });

  it("removes the KOL only after the inline confirm", async () => {
    const user = userEvent.setup();
    renderRow(true);
    await user.click(screen.getByTestId("accepted-kol-remove"));
    expect(removeKolActionMock).not.toHaveBeenCalled(); // not yet — confirm first

    const confirm = screen.getByTestId("accepted-kol-remove-confirm");
    await user.click(within(confirm).getByTestId("accepted-kol-remove-yes"));

    await waitFor(() => expect(removeKolActionMock).toHaveBeenCalledTimes(1));
    const fd = removeKolActionMock.mock.calls[0]![1] as FormData;
    expect(fd.get("campaignId")).toBe(CAMPAIGN);
    expect(fd.get("kolId")).toBe(KOL);
  });
});
